<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubcontractorController extends Controller
{
    public function __construct(private readonly AuditLogWriter $auditLogWriter)
    {
    }

    private function canRead(User $actor): bool
    {
        return $actor->hasPermission('settlements.read')
            || $actor->hasPermission('quality.read')
            || $actor->hasPermission('routes.read');
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canRead($actor)) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $limit = max(1, min((int) $request->query('limit', 20), 50));
        $q = trim((string) $request->query('q', ''));

        $query = DB::table('subcontractors')
            ->select(
                'subcontractors.id',
                'subcontractors.legal_name',
                'subcontractors.tax_id',
                'subcontractors.status',
                'subcontractors.payment_terms',
                'subcontractors.updated_at',
                DB::raw("(
                    select users.name
                    from audit_logs
                    left join users on users.id = audit_logs.actor_user_id
                    where audit_logs.event in ('subcontractors.created', 'subcontractors.updated')
                      and json_extract(audit_logs.metadata, '$.subcontractor_id') = subcontractors.id
                    order by audit_logs.id desc
                    limit 1
                ) as last_editor_name")
            )
            ->orderBy('legal_name');

        if ($q !== '') {
            $query->where(function ($nested) use ($q): void {
                $nested->where('legal_name', 'like', "%{$q}%")
                    ->orWhere('tax_id', 'like', "%{$q}%");
            });
        }

        return response()->json([
            'data' => $query->limit($limit)->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'legal_name' => ['required', 'string', 'max:180'],
            'tax_id' => ['required', 'string', 'max:60', 'unique:subcontractors,tax_id'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'payment_terms' => ['nullable', 'string', 'max:80'],
        ]);

        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table('subcontractors')->insert([
            'id' => $id,
            'legal_name' => $payload['legal_name'],
            'tax_id' => $payload['tax_id'] ?? null,
            'status' => $payload['status'] ?? 'active',
            'payment_terms' => $payload['payment_terms'] ?? 'monthly',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'subcontractors.created', [
            'subcontractor_id' => $id,
            'tax_id' => $payload['tax_id'] ?? null,
        ]);

        return response()->json([
            'data' => DB::table('subcontractors')->where('id', $id)->first(),
            'message' => 'Subcontractor created',
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('subcontractors')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Subcontractor not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'legal_name' => ['sometimes', 'string', 'max:180'],
            'tax_id' => ['sometimes', 'string', 'max:60', 'unique:subcontractors,tax_id,' . $id . ',id'],
            'status' => ['sometimes', 'in:active,inactive,suspended'],
            'payment_terms' => ['sometimes', 'string', 'max:80'],
        ]);

        DB::table('subcontractors')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'subcontractors.updated', [
            'subcontractor_id' => $id,
            'changes' => array_keys($payload),
        ]);

        return response()->json([
            'data' => DB::table('subcontractors')->where('id', $id)->first(),
            'message' => 'Subcontractor updated',
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('subcontractors')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Subcontractor not found.'],
            ], 404);
        }

        $hasDrivers = DB::table('drivers')->where('subcontractor_id', $id)->exists();
        $hasVehicles = DB::table('vehicles')->where('subcontractor_id', $id)->exists();
        $hasRoutes = DB::table('routes')->where('subcontractor_id', $id)->exists();
        $hasSettlements = DB::table('settlements')->where('subcontractor_id', $id)->exists();
        $hasAdvances = DB::table('advances')->where('subcontractor_id', $id)->exists();
        if ($hasDrivers || $hasVehicles || $hasRoutes || $hasSettlements || $hasAdvances) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_CONFLICT',
                    'message' => 'Subcontractor has linked resources and cannot be deleted.',
                ],
            ], 409);
        }

        DB::table('subcontractors')->where('id', $id)->delete();
        $this->auditLogWriter->write($actor->id, 'subcontractors.deleted', [
            'subcontractor_id' => $id,
        ]);

        return response()->json([
            'message' => 'Subcontractor deleted',
        ]);
    }

    public function bulkStatus(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['uuid', 'distinct', 'exists:subcontractors,id'],
            'status' => ['required', 'in:active,inactive,suspended'],
            'reason_code' => ['nullable', 'string', 'max:80'],
            'reason_detail' => ['nullable', 'string', 'max:220'],
            'reason' => ['nullable', 'string', 'max:220'],
        ]);

        $affected = DB::table('subcontractors')
            ->whereIn('id', $payload['ids'])
            ->update([
                'status' => $payload['status'],
                'updated_at' => now(),
            ]);

        $this->auditLogWriter->write($actor->id, 'subcontractors.bulk_status_updated', [
            'ids' => $payload['ids'],
            'status' => $payload['status'],
            'affected_count' => $affected,
            'reason_code' => $payload['reason_code'] ?? null,
            'reason_detail' => $payload['reason_detail'] ?? null,
            'reason' => $payload['reason'] ?? null,
        ]);

        return response()->json([
            'data' => [
                'affected_count' => $affected,
                'status' => $payload['status'],
            ],
            'message' => 'Bulk status updated',
        ]);
    }
}
