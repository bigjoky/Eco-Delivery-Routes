<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DriverController extends Controller
{
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
                'drivers.name',
                'drivers.status',
                'drivers.employment_type',
                'drivers.user_id',
                'drivers.subcontractor_id',
                'drivers.home_hub_id',
                'subcontractors.legal_name as subcontractor_name'
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
            'code' => ['required', 'string', 'max:60', 'unique:drivers,code'],
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
            'code' => $payload['code'],
            'name' => $payload['name'],
            'status' => $payload['status'] ?? 'active',
            'employment_type' => $payload['employment_type'] ?? 'subcontractor',
            'user_id' => $payload['user_id'] ?? null,
            'subcontractor_id' => $payload['subcontractor_id'] ?? null,
            'home_hub_id' => $payload['home_hub_id'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
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

        return response()->json([
            'data' => DB::table('drivers')->where('id', $id)->first(),
            'message' => 'Driver updated',
        ]);
    }
}

