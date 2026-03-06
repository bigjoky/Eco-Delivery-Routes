<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class IncidentController extends Controller
{
    public function __construct(private readonly SequenceService $sequenceService) {}

    public function catalog(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('incidents.read')) {
            return $this->forbidden();
        }

        $version = DB::table('incident_catalog_versions')
            ->where('is_active', true)
            ->orderByDesc('active_from')
            ->first();

        if (!$version) {
            return response()->json(['data' => ['version' => null, 'items' => []]]);
        }

        $items = DB::table('incident_catalog_items')
            ->where('version_id', $version->id)
            ->where('is_active', true)
            ->orderBy('code')
            ->get();

        return response()->json([
            'data' => [
                'version' => $version,
                'items' => $items,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('incidents.read')) {
            return $this->forbidden();
        }

        $query = DB::table('incidents')
            ->leftJoin('shipments', function ($join) {
                $join->on('shipments.id', '=', 'incidents.incidentable_id')
                    ->where('incidents.incidentable_type', '=', 'shipment');
            })
            ->orderByDesc('incidents.created_at');

        foreach (['incidentable_type', 'incidentable_id', 'category', 'catalog_code'] as $field) {
            $value = $request->query($field);
            if (is_string($value) && $value !== '') {
                $query->where($field, $value);
            }
        }

        $search = $request->query('q');
        if (is_string($search) && $search !== '') {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $query->where(function ($inner) use ($like): void {
                $inner->where('incidents.reference', 'like', $like)
                    ->orWhere('incidents.incidentable_id', 'like', $like)
                    ->orWhere('incidents.notes', 'like', $like)
                    ->orWhere('incidents.catalog_code', 'like', $like)
                    ->orWhere('shipments.reference', 'like', $like);
            });
        }

        $resolved = $request->query('resolved');
        if (is_string($resolved) && $resolved !== '') {
            if (in_array(strtolower($resolved), ['1', 'true', 'resolved'], true)) {
                $query->whereNotNull('resolved_at');
            }
            if (in_array(strtolower($resolved), ['0', 'false', 'open'], true)) {
                $query->whereNull('resolved_at');
            }
        }

        $rows = $query->get([
                'incidents.*',
                'shipments.reference as shipment_reference',
            ]);
        $rows = $rows->map(function ($row) {
            $meta = $this->incidentSlaMeta($row);
            $row->priority = $meta['priority'];
            $row->sla_due_at = $meta['sla_due_at'];
            $row->sla_status = $meta['sla_status'];
            return $row;
        });

        $priority = $request->query('priority');
        if (is_string($priority) && in_array($priority, ['high', 'medium', 'low'], true)) {
            $rows = $rows->where('priority', $priority)->values();
        }
        $slaStatus = $request->query('sla_status');
        if (is_string($slaStatus) && in_array($slaStatus, ['on_track', 'at_risk', 'breached', 'resolved'], true)) {
            $rows = $rows->where('sla_status', $slaStatus)->values();
        }

        $perPage = (int) $request->query('per_page', 20);
        $perPage = max(1, min($perPage, 100));
        $page = (int) $request->query('page', 1);
        $page = max(1, $page);
        $total = $rows->count();
        $items = $rows->slice(($page - 1) * $perPage, $perPage)->values()->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => (int) ceil($total / $perPage),
            ],
        ]);
    }

    public function board(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('incidents.read')) {
            return $this->forbidden();
        }

        $query = DB::table('incidents');
        $incidentableType = $request->query('incidentable_type');
        if (is_string($incidentableType) && in_array($incidentableType, ['shipment', 'pickup'], true)) {
            $query->where('incidentable_type', $incidentableType);
        }
        $category = $request->query('category');
        if (is_string($category) && in_array($category, ['failed', 'absent', 'retry', 'general'], true)) {
            $query->where('category', $category);
        }

        $rows = $query->get(['id', 'category', 'priority', 'sla_due_at', 'created_at', 'resolved_at']);
        $mapped = $rows->map(function ($row) {
            $meta = $this->incidentSlaMeta($row);
            return (object) [
                'resolved_at' => $row->resolved_at,
                'priority' => $meta['priority'],
                'sla_status' => $meta['sla_status'],
            ];
        });
        $openRows = $mapped->filter(fn ($row) => $row->resolved_at === null);

        return response()->json([
            'data' => [
                'total_open' => $openRows->count(),
                'total_resolved' => $mapped->count() - $openRows->count(),
                'by_priority' => [
                    'high' => $openRows->where('priority', 'high')->count(),
                    'medium' => $openRows->where('priority', 'medium')->count(),
                    'low' => $openRows->where('priority', 'low')->count(),
                ],
                'by_sla_status' => [
                    'on_track' => $openRows->where('sla_status', 'on_track')->count(),
                    'at_risk' => $openRows->where('sla_status', 'at_risk')->count(),
                    'breached' => $openRows->where('sla_status', 'breached')->count(),
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $start = microtime(true);
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('incidents.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'incidentable_type' => ['required', 'in:shipment,pickup'],
            'incidentable_id' => ['required', 'uuid'],
            'catalog_code' => ['required', 'string', 'max:80'],
            'category' => ['required', 'in:failed,absent,retry,general'],
            'notes' => ['nullable', 'string'],
        ]);

        $activeVersionId = DB::table('incident_catalog_versions')
            ->where('is_active', true)
            ->orderByDesc('active_from')
            ->value('id');

        if (!$activeVersionId) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Active incident catalog not configured.'],
            ], 422);
        }

        $catalogItem = DB::table('incident_catalog_items')
            ->where('version_id', $activeVersionId)
            ->where('code', $payload['catalog_code'])
            ->where('is_active', true)
            ->first();

        if (!$catalogItem) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Invalid incident catalog code.'],
            ], 422);
        }

        if ($catalogItem->category !== $payload['category']) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Incident category does not match catalog code.'],
            ], 422);
        }

        if ($catalogItem->applies_to !== 'both' && $catalogItem->applies_to !== $payload['incidentable_type']) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Catalog code not applicable to target type.'],
            ], 422);
        }

        $id = (string) Str::uuid();
        $reference = (string) $this->sequenceService->next('incidents');
        $priority = (string) ($catalogItem->priority ?? $this->defaultPriorityByCategory((string) $payload['category']));
        $slaMinutes = (int) ($catalogItem->sla_minutes ?? $this->defaultSlaMinutesByPriority($priority));
        $slaDueAt = now()->addMinutes(max(1, $slaMinutes));
        DB::table('incidents')->insert([
            'id' => $id,
            'reference' => $reference,
            'incidentable_type' => $payload['incidentable_type'],
            'incidentable_id' => $payload['incidentable_id'],
            'catalog_code' => $payload['catalog_code'],
            'category' => $payload['category'],
            'priority' => $priority,
            'sla_due_at' => $slaDueAt,
            'notes' => $payload['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Log::info('ops.incident.created', [
            'actor_user_id' => $actor->id,
            'incidentable_type' => $payload['incidentable_type'],
            'incidentable_id' => $payload['incidentable_id'],
            'catalog_code' => $payload['catalog_code'],
            'latency_ms' => (int) round((microtime(true) - $start) * 1000),
        ]);

        $row = DB::table('incidents')->where('id', $id)->first();
        if ($row) {
            $meta = $this->incidentSlaMeta($row);
            $row->priority = $meta['priority'];
            $row->sla_due_at = $meta['sla_due_at'];
            $row->sla_status = $meta['sla_status'];
        }
        return response()->json(['data' => $row], 201);
    }

    public function resolve(Request $request, string $id): JsonResponse
    {
        $start = microtime(true);
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('incidents.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        $exists = DB::table('incidents')->where('id', $id)->exists();
        if (!$exists) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Incident not found.'],
            ], 404);
        }

        DB::table('incidents')->where('id', $id)->update([
            'notes' => $payload['notes'] ?? DB::raw('notes'),
            'resolved_at' => now(),
            'updated_at' => now(),
        ]);

        Log::info('ops.incident.resolved', [
            'actor_user_id' => $actor->id,
            'incident_id' => $id,
            'latency_ms' => (int) round((microtime(true) - $start) * 1000),
        ]);

        $row = DB::table('incidents')->where('id', $id)->first();
        if ($row) {
            $meta = $this->incidentSlaMeta($row);
            $row->priority = $meta['priority'];
            $row->sla_due_at = $meta['sla_due_at'];
            $row->sla_status = $meta['sla_status'];
        }

        return response()->json(['data' => $row]);
    }

    public function overrideSla(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('incidents.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'priority' => ['nullable', 'in:high,medium,low'],
            'sla_due_at' => ['nullable', 'date'],
            'reason' => ['required', 'string', 'max:220'],
        ]);

        $incident = DB::table('incidents')->where('id', $id)->first();
        if (!$incident) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Incident not found.'],
            ], 404);
        }

        $nextPriority = $payload['priority'] ?? ($incident->priority ?? $this->defaultPriorityByCategory((string) $incident->category));
        $nextSlaDueAt = $payload['sla_due_at'] ?? ($incident->sla_due_at ?? null);
        if ($nextSlaDueAt === null) {
            $nextSlaDueAt = now()->addMinutes($this->defaultSlaMinutesByPriority((string) $nextPriority))->toDateTimeString();
        }

        DB::table('incidents')->where('id', $id)->update([
            'priority' => $nextPriority,
            'sla_due_at' => $nextSlaDueAt,
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'incidents.sla.overridden',
            'metadata' => json_encode([
                'incident_id' => $id,
                'previous_priority' => $incident->priority ?? null,
                'next_priority' => $nextPriority,
                'previous_sla_due_at' => $incident->sla_due_at ?? null,
                'next_sla_due_at' => $nextSlaDueAt,
                'reason' => $payload['reason'],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('incidents')->where('id', $id)->first();
        if ($row) {
            $meta = $this->incidentSlaMeta($row);
            $row->priority = $meta['priority'];
            $row->sla_due_at = $meta['sla_due_at'];
            $row->sla_status = $meta['sla_status'];
        }

        return response()->json(['data' => $row]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }

    /**
     * @return array{priority:string,sla_due_at:string,sla_status:string}
     */
    private function incidentSlaMeta(object $row): array
    {
        $priority = (string) ($row->priority ?? $this->defaultPriorityByCategory((string) ($row->category ?? 'general')));
        $dueAt = strtotime((string) ($row->sla_due_at ?? ''));
        if (!$dueAt) {
            $createdAt = strtotime((string) $row->created_at) ?: time();
            $dueAt = $createdAt + ($this->defaultSlaMinutesByPriority($priority) * 60);
        }
        $now = time();
        $slaStatus = 'on_track';
        if (!empty($row->resolved_at)) {
            $slaStatus = 'resolved';
        } elseif ($dueAt < $now) {
            $slaStatus = 'breached';
        } elseif (($dueAt - $now) <= 3600) {
            $slaStatus = 'at_risk';
        }

        return [
            'priority' => $priority,
            'sla_due_at' => date(DATE_ATOM, $dueAt),
            'sla_status' => $slaStatus,
        ];
    }

    private function defaultPriorityByCategory(string $category): string
    {
        return match ($category) {
            'failed' => 'high',
            'absent', 'retry' => 'medium',
            default => 'low',
        };
    }

    private function defaultSlaMinutesByPriority(string $priority): int
    {
        return match ($priority) {
            'high' => 4 * 60,
            'medium' => 8 * 60,
            default => 24 * 60,
        };
    }
}
