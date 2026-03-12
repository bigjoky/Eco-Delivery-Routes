<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Roles\ListRolesAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Roles\UpdateRolePermissionsRequest;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function __construct(
        private readonly ListRolesAction $listRolesAction,
        private readonly AuditLogWriter $auditLogWriter
    )
    {
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->hasPermission('roles.read')) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => $this->listRolesAction->execute(),
            'message' => 'Roles index',
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->hasPermission('roles.read')) {
            return $this->forbidden();
        }

        $role = Role::query()->with('permissions:id,code,name')->find($id);
        if (!$role) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_NOT_FOUND',
                    'message' => 'Role not found.',
                ],
            ], 404);
        }

        return response()->json([
            'data' => [
                'id' => $role->id,
                'code' => $role->code,
                'name' => $role->name,
                'permissions' => $role->permissions->map(fn (Permission $permission) => [
                    'id' => $permission->id,
                    'code' => $permission->code,
                    'name' => $permission->name,
                ])->values()->all(),
                'available_permissions' => Permission::query()
                    ->orderBy('code')
                    ->get(['id', 'code', 'name'])
                    ->map(fn (Permission $permission) => [
                        'id' => $permission->id,
                        'code' => $permission->code,
                        'name' => $permission->name,
                    ])->values()->all(),
                'users_count' => $role->users()->count(),
            ],
            'message' => 'Role detail',
        ]);
    }

    public function updatePermissions(UpdateRolePermissionsRequest $request, string $id): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->hasPermission('roles.assign')) {
            return $this->forbidden();
        }

        $role = Role::query()->find($id);
        if (!$role) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_NOT_FOUND',
                    'message' => 'Role not found.',
                ],
            ], 404);
        }

        $validatedIds = Permission::query()
            ->whereIn('id', $request->validated('permission_ids'))
            ->pluck('id')
            ->all();
        $before = $role->permissions()->pluck('permissions.id')->all();
        $role->permissions()->sync($validatedIds);
        $after = $role->permissions()->pluck('permissions.id')->all();

        $this->auditLogWriter->write($actor->id, 'role.permissions.assigned', [
            'role_id' => $role->id,
            'before_permission_ids' => $before,
            'after_permission_ids' => $after,
            'added_permission_ids' => array_values(array_diff($after, $before)),
            'removed_permission_ids' => array_values(array_diff($before, $after)),
        ]);

        return $this->show($request, $id);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => [
                'code' => 'AUTH_UNAUTHORIZED',
                'message' => 'Unauthorized.',
            ],
        ], 403);
    }
}
