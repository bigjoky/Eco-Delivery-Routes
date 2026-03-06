<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DriverController extends Controller
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

        $query = DB::table('drivers')
            ->leftJoin('subcontractors', 'subcontractors.id', '=', 'drivers.subcontractor_id')
            ->select(
                'drivers.id',
                'drivers.code',
                'drivers.dni',
                'drivers.name',
                'drivers.status',
                'drivers.employment_type',
                'drivers.user_id',
                'drivers.subcontractor_id',
                'drivers.home_hub_id',
                'drivers.updated_at',
                'subcontractors.legal_name as subcontractor_name',
                DB::raw("(
                    select users.name
                    from audit_logs
                    left join users on users.id = audit_logs.actor_user_id
                    where audit_logs.event in ('drivers.created', 'drivers.updated')
                      and json_extract(audit_logs.metadata, '$.driver_id') = drivers.id
                    order by audit_logs.id desc
                    limit 1
                ) as last_editor_name")
            )
            ->orderBy('drivers.code');

        if (is_string($subcontractorId) && $subcontractorId !== '') {
            $query->where('drivers.subcontractor_id', $subcontractorId);
        }
        if (is_string($status) && $status !== '') {
            $query->where('drivers.status', $status);
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
            'code' => ['nullable', 'string', 'max:60', 'unique:drivers,code'],
            'dni' => ['required', 'string', 'max:40', 'unique:drivers,dni'],
            'name' => ['required', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'employment_type' => ['nullable', 'in:employee,subcontractor'],
            'user_id' => ['nullable', 'uuid'],
            'subcontractor_id' => ['nullable', 'uuid'],
            'home_hub_id' => ['nullable', 'uuid'],
        ]);

        $id = (string) Str::uuid();
        DB::table('drivers')->insert([
            'id' => $id,
            'code' => $payload['code'] ?? $payload['dni'],
            'dni' => $payload['dni'],
            'name' => $payload['name'],
            'status' => $payload['status'] ?? 'active',
            'employment_type' => $payload['employment_type'] ?? 'subcontractor',
            'user_id' => $payload['user_id'] ?? null,
            'subcontractor_id' => $payload['subcontractor_id'] ?? null,
            'home_hub_id' => $payload['home_hub_id'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'drivers.created', [
            'driver_id' => $id,
            'dni' => $payload['dni'],
        ]);

        return response()->json([
            'data' => DB::table('drivers')->where('id', $id)->first(),
            'message' => 'Driver created',
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

        $row = DB::table('drivers')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Driver not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'dni' => ['sometimes', 'string', 'max:40', 'unique:drivers,dni,' . $id . ',id'],
            'status' => ['sometimes', 'in:active,inactive,suspended'],
            'employment_type' => ['sometimes', 'in:employee,subcontractor'],
            'user_id' => ['sometimes', 'nullable', 'uuid'],
            'subcontractor_id' => ['sometimes', 'nullable', 'uuid'],
            'home_hub_id' => ['sometimes', 'nullable', 'uuid'],
        ]);

        DB::table('drivers')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'drivers.updated', [
            'driver_id' => $id,
            'changes' => array_keys($payload),
        ]);

        return response()->json([
            'data' => DB::table('drivers')->where('id', $id)->first(),
            'message' => 'Driver updated',
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

        $row = DB::table('drivers')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Driver not found.'],
            ], 404);
        }

        $hasRoutes = DB::table('routes')->where('driver_id', $id)->exists();
        $hasAssignedVehicles = DB::table('vehicles')->where('assigned_driver_id', $id)->exists();
        if ($hasRoutes || $hasAssignedVehicles) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_CONFLICT',
                    'message' => 'Driver has linked resources and cannot be deleted.',
                ],
            ], 409);
        }

        DB::table('drivers')->where('id', $id)->delete();
        $this->auditLogWriter->write($actor->id, 'drivers.deleted', [
            'driver_id' => $id,
        ]);

        return response()->json([
            'message' => 'Driver deleted',
        ]);
    }
}
