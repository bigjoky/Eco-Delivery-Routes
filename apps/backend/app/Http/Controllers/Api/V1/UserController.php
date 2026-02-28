<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Users\ListUsersAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Users\AssignRolesRequest;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        private readonly ListUsersAction $listUsersAction,
        private readonly AuditLogWriter $auditLogWriter
    )
    {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('users.read')) {
            return $this->forbidden();
        }

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $sort = (string) $request->query('sort', 'name');
        $dir = (string) $request->query('dir', 'asc');
        $query = $request->filled('q') ? (string) $request->query('q') : null;
        $status = $request->filled('status') ? (string) $request->query('status') : null;
        $payload = $this->listUsersAction->execute($query, $status, $sort, $dir, $page, $perPage);

        return response()->json([
            'data' => $payload['data'],
            'meta' => $payload['meta'],
            'message' => 'Users index',
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('users.create')) {
            return $this->forbidden();
        }

        $payload = $request->validated();
        $user = User::query()->create([
            'name' => $payload['name'],
            'email' => $payload['email'],
            'password' => $payload['password'],
            'status' => $payload['status'],
        ]);

        if (!empty($payload['role_ids'])) {
            $roles = Role::query()->whereIn('id', $payload['role_ids'])->pluck('id')->all();
            $user->roles()->sync($roles);
        }
        $user->load('roles:id,code,name');
        $this->auditLogWriter->write($actor->id, 'user.created', [
            'user_id' => $user->id,
            'status' => $user->status,
            'role_ids' => $user->roles->pluck('id')->all(),
        ]);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'last_login_at' => optional($user->last_login_at)?->toISOString(),
                'roles' => $user->roles->map(fn ($role) => [
                    'id' => $role->id,
                    'code' => $role->code,
                    'name' => $role->name,
                ])->values()->all(),
            ],
            'message' => 'User created',
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $user = User::query()->find($id);

        if (!$user) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_NOT_FOUND',
                    'message' => 'User not found.',
                ],
            ], 404);
        }

        if (!$actor->hasPermission('users.read') && $actor->id !== $user->id) {
            return $this->forbidden();
        }
        $user->load('roles:id,code,name');

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'last_login_at' => optional($user->last_login_at)?->toISOString(),
                'roles' => $user->roles->map(fn ($role) => [
                    'id' => $role->id,
                    'code' => $role->code,
                    'name' => $role->name,
                ])->values()->all(),
            ],
            'message' => 'User detail',
        ]);
    }

    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $user = User::query()->find($id);

        if (!$user) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_NOT_FOUND',
                    'message' => 'User not found.',
                ],
            ], 404);
        }

        if (!$actor->hasPermission('users.update') && $actor->id !== $user->id) {
            return $this->forbidden();
        }

        $before = $user->only(['name', 'email', 'status']);
        $user->fill($request->validated())->save();
        $user->load('roles:id,code,name');
        $this->auditLogWriter->write($actor->id, 'user.updated', [
            'user_id' => $user->id,
            'before' => $before,
            'after' => $user->only(['name', 'email', 'status']),
        ]);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'last_login_at' => optional($user->last_login_at)?->toISOString(),
                'roles' => $user->roles->map(fn ($role) => [
                    'id' => $role->id,
                    'code' => $role->code,
                    'name' => $role->name,
                ])->values()->all(),
            ],
            'message' => 'User updated',
        ]);
    }

    public function assignRoles(AssignRolesRequest $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('roles.assign')) {
            return $this->forbidden();
        }

        $user = User::query()->find($id);
        if (!$user) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_NOT_FOUND',
                    'message' => 'User not found.',
                ],
            ], 404);
        }

        $validatedIds = Role::query()
            ->whereIn('id', $request->validated('role_ids'))
            ->pluck('id')
            ->all();

        $user->roles()->sync($validatedIds);
        $this->auditLogWriter->write($actor->id, 'user.roles.assigned', [
            'user_id' => $user->id,
            'role_ids' => $validatedIds,
        ]);

        return response()->json([
            'data' => [
                'user_id' => $user->id,
                'role_ids' => $validatedIds,
            ],
            'message' => 'Roles assigned',
        ]);
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
