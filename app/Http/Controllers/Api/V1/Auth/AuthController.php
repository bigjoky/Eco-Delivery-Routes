<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Application\Auth\LoginAction;
use App\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Infrastructure\Auth\AuditLogWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(
        private readonly LoginAction $loginAction,
        private readonly AuditLogWriter $auditLogWriter
    ) {
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $result = $this->loginAction->execute(
            $payload['email'],
            $payload['password'],
            $payload['device_name'] ?? null,
            $request->ip()
        );

        if (!$result) {
            return response()->json([
                'error' => [
                    'code' => 'AUTH_INVALID_CREDENTIALS',
                    'message' => 'Invalid credentials.',
                ],
            ], 401);
        }

        /** @var User $user */
        $user = $result['user'];
        $token = $result['token'];

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token->token,
            'token_type' => $token->tokenType,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();
        $token = $user?->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        $this->auditLogWriter->write($user?->id, 'auth.logout.succeeded', ['ip' => $request->ip()]);

        return response()->json(['message' => 'Logout successful.']);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'last_login_at' => optional($user->last_login_at)->toISOString(),
                'roles' => $user->roles()->get(['id', 'code', 'name']),
            ],
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();
        $token = $user?->currentAccessToken();

        if (!$user || !$token) {
            return response()->json([
                'error' => [
                    'code' => 'AUTH_UNAUTHORIZED',
                    'message' => 'Unauthorized.',
                ],
            ], 401);
        }

        $token->delete();
        $plainTextToken = $user->createToken('api-client')->plainTextToken;

        return response()->json([
            'message' => 'Token refreshed.',
            'token' => $plainTextToken,
            'token_type' => 'Bearer',
        ]);
    }
}
