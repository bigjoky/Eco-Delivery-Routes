<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Users\ListUsersAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Users\AssignRolesRequest;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(private readonly ListUsersAction $listUsersAction)
    {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('users.read')) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => $this->listUsersAction->execute(),
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

        return response()->json([
            'data' => $user->only(['id', 'name', 'email', 'status']),
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

        return response()->json([
            'data' => $user->only(['id', 'name', 'email', 'status', 'last_login_at']),
            'roles' => $user->roles()->get(['id', 'code', 'name']),
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

        $user->fill($request->validated())->save();

        return response()->json([
            'data' => $user->only(['id', 'name', 'email', 'status']),
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
