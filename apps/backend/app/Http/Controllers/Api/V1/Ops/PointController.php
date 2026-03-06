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

class PointController extends Controller
{
    public function __construct(
        private readonly SequenceService $sequenceService,
        private readonly AuditLogWriter $auditLogWriter
    ) {}

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
        if (!$request->boolean('include_deleted', false)) {
            $query->whereNull('deleted_at');
        }
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

        if (!DB::table('hubs')->where('id', $payload['hub_id'])->whereNull('deleted_at')->exists()) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Hub not found.',
                ],
            ], 422);
        }

        if (!$this->isDepotConsistentWithHub($payload['hub_id'], $payload['depot_id'] ?? null)) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Depot does not belong to selected hub.',
                ],
            ], 422);
        }

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
            'deleted_at' => null,
        ]);
        $this->auditLogWriter->write($actor->id, 'points.created', [
            'point_id' => $id,
            'hub_id' => $payload['hub_id'],
            'depot_id' => $payload['depot_id'] ?? null,
            'point_code' => $code,
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

        $row = DB::table('points')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Point not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'hub_id' => ['sometimes', 'uuid', 'exists:hubs,id'],
            'depot_id' => ['sometimes', 'nullable', 'uuid', 'exists:depots,id'],
            'code' => ['sometimes', 'string', 'max:40', 'unique:points,code,' . $id . ',id'],
            'name' => ['sometimes', 'string', 'max:120'],
            'address_line' => ['sometimes', 'nullable', 'string', 'max:220'],
            'city' => ['sometimes', 'nullable', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $nextHubId = (string) ($payload['hub_id'] ?? $row->hub_id);
        $nextDepotId = array_key_exists('depot_id', $payload) ? $payload['depot_id'] : $row->depot_id;
        if (!DB::table('hubs')->where('id', $nextHubId)->whereNull('deleted_at')->exists()) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Hub not found.',
                ],
            ], 422);
        }
        if (!$this->isDepotConsistentWithHub($nextHubId, is_string($nextDepotId) ? $nextDepotId : null)) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Depot does not belong to selected hub.',
                ],
            ], 422);
        }

        DB::table('points')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'points.updated', [
            'point_id' => $id,
            'changes' => array_keys($payload),
        ]);

        return response()->json(['data' => DB::table('points')->where('id', $id)->whereNull('deleted_at')->first()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('points.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('points')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Point not found.'],
            ], 404);
        }

        DB::table('points')->where('id', $id)->update([
            'deleted_at' => now(),
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'points.deleted', [
            'point_id' => $id,
        ]);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }

    public function restore(Request $request, string $id): JsonResponse
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
        if ($row->deleted_at === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_CONFLICT', 'message' => 'Point is already active.'],
            ], 409);
        }

        if (!DB::table('hubs')->where('id', $row->hub_id)->whereNull('deleted_at')->exists()) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_CONFLICT', 'message' => 'Cannot restore point while parent hub is archived.'],
            ], 409);
        }
        if (!$this->isDepotConsistentWithHub((string) $row->hub_id, is_string($row->depot_id) ? $row->depot_id : null)) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_CONFLICT', 'message' => 'Cannot restore point while parent depot is archived or inconsistent.'],
            ], 409);
        }

        DB::table('points')->where('id', $id)->update([
            'deleted_at' => null,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'points.restored', [
            'point_id' => $id,
        ]);

        return response()->json(['data' => DB::table('points')->where('id', $id)->first()]);
    }

    private function isDepotConsistentWithHub(string $hubId, ?string $depotId): bool
    {
        if (!$depotId) {
            return true;
        }

        $depotHubId = DB::table('depots')->where('id', $depotId)->whereNull('deleted_at')->value('hub_id');

        return is_string($depotHubId) && $depotHubId === $hubId;
    }
}
