<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VehicleController extends Controller
{
    public function __construct(private readonly AuditLogWriter $auditLogWriter)
    {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $limit = max(1, min((int) $request->query('limit', 50), 100));
        $subcontractorId = $request->query('subcontractor_id');
        $status = $request->query('status');

        $query = DB::table('vehicles')
            ->leftJoin('subcontractors', 'subcontractors.id', '=', 'vehicles.subcontractor_id')
            ->leftJoin('drivers', 'drivers.id', '=', 'vehicles.assigned_driver_id')
            ->select(
                'vehicles.id',
                'vehicles.code',
                'vehicles.plate_number',
                'vehicles.vehicle_type',
                'vehicles.brand',
                'vehicles.model',
                'vehicles.fuel_type',
                'vehicles.ownership_type',
                'vehicles.capacity_kg',
                'vehicles.volume_m3',
                'vehicles.is_refrigerated',
                'vehicles.thermo_cert_expires_at',
                'vehicles.insurance_expires_at',
                'vehicles.itv_expires_at',
                'vehicles.notes',
                'vehicles.status',
                'vehicles.subcontractor_id',
                'vehicles.home_hub_id',
                'vehicles.assigned_driver_id',
                'vehicles.updated_at',
                'subcontractors.legal_name as subcontractor_name',
                'drivers.code as assigned_driver_code',
                DB::raw("(
                    select users.name
                    from audit_logs
                    left join users on users.id = audit_logs.actor_user_id
                    where audit_logs.event in ('vehicles.created', 'vehicles.updated')
                      and json_extract(audit_logs.metadata, '$.vehicle_id') = vehicles.id
                    order by audit_logs.id desc
                    limit 1
                ) as last_editor_name")
            )
            ->orderBy('vehicles.plate_number');

        if (is_string($subcontractorId) && $subcontractorId !== '') {
            $query->where('vehicles.subcontractor_id', $subcontractorId);
        }
        if (is_string($status) && $status !== '') {
            $query->where('vehicles.status', $status);
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
            'code' => ['nullable', 'string', 'max:60', 'unique:vehicles,code'],
            'plate_number' => ['required', 'string', 'max:20', 'unique:vehicles,plate_number'],
            'vehicle_type' => ['nullable', 'string', 'max:40'],
            'brand' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:80'],
            'fuel_type' => ['nullable', 'string', 'max:40'],
            'ownership_type' => ['nullable', 'string', 'max:40'],
            'capacity_kg' => ['nullable', 'integer', 'min:1'],
            'volume_m3' => ['nullable', 'numeric', 'min:0'],
            'is_refrigerated' => ['nullable', 'boolean'],
            'thermo_cert_expires_at' => ['nullable', 'date'],
            'insurance_expires_at' => ['nullable', 'date'],
            'itv_expires_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'status' => ['nullable', 'in:active,inactive,maintenance'],
            'subcontractor_id' => ['nullable', 'uuid'],
            'home_hub_id' => ['nullable', 'uuid'],
            'assigned_driver_id' => ['nullable', 'uuid'],
        ]);

        $id = (string) Str::uuid();
        DB::table('vehicles')->insert([
            'id' => $id,
            'code' => $payload['code'] ?? $payload['plate_number'],
            'plate_number' => $payload['plate_number'],
            'vehicle_type' => $payload['vehicle_type'] ?? 'van',
            'brand' => $payload['brand'] ?? null,
            'model' => $payload['model'] ?? null,
            'fuel_type' => $payload['fuel_type'] ?? null,
            'ownership_type' => $payload['ownership_type'] ?? null,
            'capacity_kg' => $payload['capacity_kg'] ?? null,
            'volume_m3' => $payload['volume_m3'] ?? null,
            'is_refrigerated' => $payload['is_refrigerated'] ?? false,
            'thermo_cert_expires_at' => $payload['thermo_cert_expires_at'] ?? null,
            'insurance_expires_at' => $payload['insurance_expires_at'] ?? null,
            'itv_expires_at' => $payload['itv_expires_at'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'status' => $payload['status'] ?? 'active',
            'subcontractor_id' => $payload['subcontractor_id'] ?? null,
            'home_hub_id' => $payload['home_hub_id'] ?? null,
            'assigned_driver_id' => $payload['assigned_driver_id'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'vehicles.created', [
            'vehicle_id' => $id,
            'plate_number' => $payload['plate_number'],
        ]);

        return response()->json([
            'data' => DB::table('vehicles')->where('id', $id)->first(),
            'message' => 'Vehicle created',
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

        $row = DB::table('vehicles')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Vehicle not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'plate_number' => ['sometimes', 'nullable', 'string', 'max:20', 'unique:vehicles,plate_number,' . $id . ',id'],
            'vehicle_type' => ['sometimes', 'string', 'max:40'],
            'brand' => ['sometimes', 'nullable', 'string', 'max:80'],
            'model' => ['sometimes', 'nullable', 'string', 'max:80'],
            'fuel_type' => ['sometimes', 'nullable', 'string', 'max:40'],
            'ownership_type' => ['sometimes', 'nullable', 'string', 'max:40'],
            'capacity_kg' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'volume_m3' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'is_refrigerated' => ['sometimes', 'boolean'],
            'thermo_cert_expires_at' => ['sometimes', 'nullable', 'date'],
            'insurance_expires_at' => ['sometimes', 'nullable', 'date'],
            'itv_expires_at' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:active,inactive,maintenance'],
            'subcontractor_id' => ['sometimes', 'nullable', 'uuid'],
            'home_hub_id' => ['sometimes', 'nullable', 'uuid'],
            'assigned_driver_id' => ['sometimes', 'nullable', 'uuid'],
        ]);

        DB::table('vehicles')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'vehicles.updated', [
            'vehicle_id' => $id,
            'changes' => array_keys($payload),
        ]);

        return response()->json([
            'data' => DB::table('vehicles')->where('id', $id)->first(),
            'message' => 'Vehicle updated',
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

        $row = DB::table('vehicles')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Vehicle not found.'],
            ], 404);
        }

        $hasRoutes = DB::table('routes')->where('vehicle_id', $id)->exists();
        if ($hasRoutes) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_CONFLICT',
                    'message' => 'Vehicle has linked routes and cannot be deleted.',
                ],
            ], 409);
        }

        DB::table('vehicles')->where('id', $id)->delete();
        $this->auditLogWriter->write($actor->id, 'vehicles.deleted', [
            'vehicle_id' => $id,
        ]);

        return response()->json([
            'message' => 'Vehicle deleted',
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
            'ids.*' => ['uuid', 'distinct', 'exists:vehicles,id'],
            'status' => ['required', 'in:active,inactive,maintenance'],
            'reason_code' => ['nullable', 'string', 'max:80'],
            'reason_detail' => ['nullable', 'string', 'max:220'],
            'reason' => ['nullable', 'string', 'max:220'],
        ]);

        $affected = DB::table('vehicles')
            ->whereIn('id', $payload['ids'])
            ->update([
                'status' => $payload['status'],
                'updated_at' => now(),
            ]);

        $this->auditLogWriter->write($actor->id, 'vehicles.bulk_status_updated', [
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
