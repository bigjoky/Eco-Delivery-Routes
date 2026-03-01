<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PointController extends Controller
{
    public function __construct(private readonly SequenceService $sequenceService) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('points.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $hubId = $request->query('hub_id');
        $depotId = $request->query('depot_id');
        $query = DB::table('points')->orderBy('code');
        if (is_string($hubId) && $hubId !== '') {
            $query->where('hub_id', $hubId);
        }
        if (is_string($depotId) && $depotId !== '') {
            $query->where('depot_id', $depotId);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('points.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'hub_id' => ['required', 'uuid', 'exists:hubs,id'],
            'depot_id' => ['nullable', 'uuid', 'exists:depots,id'],
            'code' => ['nullable', 'string', 'max:40', 'unique:points,code'],
            'name' => ['required', 'string', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'city' => ['nullable', 'string', 'max:80'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $id = (string) Str::uuid();
        $code = $payload['code'] ?? (string) $this->sequenceService->next('points');
        DB::table('points')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'depot_id' => $payload['depot_id'] ?? null,
            'code' => $code,
            'name' => $payload['name'],
            'address_line' => $payload['address_line'] ?? null,
            'city' => $payload['city'] ?? null,
            'is_active' => $payload['is_active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('points')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('points.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('points')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Point not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'code' => ['sometimes', 'string', 'max:40', 'unique:points,code,' . $id . ',id'],
            'name' => ['sometimes', 'string', 'max:120'],
            'address_line' => ['sometimes', 'nullable', 'string', 'max:220'],
            'city' => ['sometimes', 'nullable', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        DB::table('points')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('points')->where('id', $id)->first()]);
    }
}
