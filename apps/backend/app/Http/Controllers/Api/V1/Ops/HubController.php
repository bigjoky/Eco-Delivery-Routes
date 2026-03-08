<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\User;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HubController extends Controller
{
    public function __construct(
        private readonly SequenceService $sequenceService,
        private readonly AuditLogWriter $auditLogWriter
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (
            !$actor->hasPermission('hubs.read')
            && !$actor->hasPermission('points.read')
            && !$actor->hasPermission('depots.read')
            && !$actor->hasPermission('settlements.read')
            && !$actor->hasPermission('routes.read')
            && !$actor->hasPermission('shipments.read')
            && !$actor->hasPermission('shipments.write')
        ) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $query = DB::table('hubs')
            ->orderBy('code');

        if (!$request->boolean('include_deleted', false)) {
            $query->whereNull('deleted_at');
        }

        if ($request->boolean('only_active', true)) {
            $query->where('is_active', true);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('hubs.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'code' => ['nullable', 'string', 'max:40', 'unique:hubs,code'],
            'name' => ['required', 'string', 'max:120'],
            'city' => ['required', 'string', 'max:80'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $id = (string) Str::uuid();
        $code = $payload['code'] ?? (string) $this->sequenceService->next('hubs');
        DB::table('hubs')->insert([
            'id' => $id,
            'code' => $code,
            'name' => $payload['name'],
            'city' => $payload['city'],
            'is_active' => $payload['is_active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
        $this->auditLogWriter->write($actor->id, 'hubs.created', [
            'hub_id' => $id,
            'hub_code' => $code,
        ]);

        return response()->json(['data' => DB::table('hubs')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('hubs.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('hubs')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Hub not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'code' => ['sometimes', 'string', 'max:40', 'unique:hubs,code,' . $id . ',id'],
            'name' => ['sometimes', 'string', 'max:120'],
            'city' => ['sometimes', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        DB::table('hubs')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'hubs.updated', [
            'hub_id' => $id,
            'changes' => array_keys($payload),
        ]);

        return response()->json(['data' => DB::table('hubs')->where('id', $id)->whereNull('deleted_at')->first()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('hubs.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('hubs')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Hub not found.'],
            ], 404);
        }

        $linkedCounters = [
            'depots' => DB::table('depots')->where('hub_id', $id)->whereNull('deleted_at')->count(),
            'points' => DB::table('points')->where('hub_id', $id)->whereNull('deleted_at')->count(),
            'routes' => DB::table('routes')->where('hub_id', $id)->count(),
            'shipments' => DB::table('shipments')->where('hub_id', $id)->count(),
            'pickups' => DB::table('pickups')->where('hub_id', $id)->count(),
            'drivers' => DB::table('drivers')->where('home_hub_id', $id)->count(),
            'vehicles' => DB::table('vehicles')->where('home_hub_id', $id)->count(),
        ];
        $blockedBy = collect($linkedCounters)
            ->filter(fn (int $count): bool => $count > 0)
            ->keys()
            ->values()
            ->all();

        if (!empty($blockedBy)) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_CONFLICT',
                    'message' => 'Hub has linked resources and cannot be deleted.',
                    'details' => ['blocked_by' => $blockedBy],
                ],
            ], 409);
        }

        DB::table('hubs')->where('id', $id)->update([
            'deleted_at' => now(),
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'hubs.deleted', [
            'hub_id' => $id,
        ]);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }

    public function restore(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('hubs.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('hubs')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Hub not found.'],
            ], 404);
        }
        if ($row->deleted_at === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_CONFLICT', 'message' => 'Hub is already active.'],
            ], 409);
        }

        DB::table('hubs')->where('id', $id)->update([
            'deleted_at' => null,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'hubs.restored', [
            'hub_id' => $id,
        ]);

        return response()->json(['data' => DB::table('hubs')->where('id', $id)->first()]);
    }
}
