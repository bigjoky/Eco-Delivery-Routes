<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class IncidentController extends Controller
{
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

        $query = DB::table('incidents')->orderByDesc('created_at');

        foreach (['incidentable_type', 'incidentable_id', 'category', 'catalog_code'] as $field) {
            $value = $request->query($field);
            if (is_string($value) && $value !== '') {
                $query->where($field, $value);
            }
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

        $perPage = (int) $request->query('per_page', 20);
        $perPage = max(1, min($perPage, 100));
        $page = (int) $request->query('page', 1);
        $page = max(1, $page);

        $total = (clone $query)->count();
        $items = $query
            ->forPage($page, $perPage)
            ->get();

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
        DB::table('incidents')->insert([
            'id' => $id,
            'incidentable_type' => $payload['incidentable_type'],
            'incidentable_id' => $payload['incidentable_id'],
            'catalog_code' => $payload['catalog_code'],
            'category' => $payload['category'],
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

        return response()->json(['data' => DB::table('incidents')->where('id', $id)->first()], 201);
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

        return response()->json(['data' => DB::table('incidents')->where('id', $id)->first()]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}
