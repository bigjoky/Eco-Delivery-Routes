<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Roles\ListRolesAction;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function __construct(private readonly ListRolesAction $listRolesAction)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->hasPermission('roles.read')) {
            return response()->json([
                'error' => [
                    'code' => 'AUTH_UNAUTHORIZED',
                    'message' => 'Unauthorized.',
                ],
            ], 403);
        }

        return response()->json([
            'data' => $this->listRolesAction->execute(),
            'message' => 'Roles index',
        ]);
    }
}
