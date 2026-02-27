<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HubController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.read') && !$actor->hasPermission('routes.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $query = DB::table('hubs')
            ->orderBy('code');

        if ($request->boolean('only_active', true)) {
            $query->where('is_active', true);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }
}

