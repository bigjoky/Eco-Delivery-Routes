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

class DepotController extends Controller
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
            !$actor->hasPermission('depots.read')
            && !$actor->hasPermission('hubs.read')
            && !$actor->hasPermission('points.read')
            && !$actor->hasPermission('routes.read')
            && !$actor->hasPermission('shipments.read')
            && !$actor->hasPermission('shipments.write')
        ) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $hubId = $request->query('hub_id');
        $query = DB::table('depots')->orderBy('code');
        if (!$request->boolean('include_deleted', false)) {
            $query->whereNull('deleted_at');
        }
        if (is_string($hubId) && $hubId !== '') {
            $query->where('hub_id', $hubId);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('depots.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'hub_id' => ['required', 'uuid', 'exists:hubs,id'],
            'code' => ['nullable', 'string', 'max:40', 'unique:depots,code'],
            'name' => ['required', 'string', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'city' => ['nullable', 'string', 'max:80'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'province' => ['nullable', 'string', 'max:80'],
            'country' => ['nullable', 'string', 'size:2'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'contact_email' => ['nullable', 'email', 'max:160'],
            'manager_name' => ['nullable', 'string', 'max:120'],
            'opening_hours' => ['nullable', 'string', 'max:120'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:1000'],
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

        $id = (string) Str::uuid();
        $code = $payload['code'] ?? (string) $this->sequenceService->next('depots');
        DB::table('depots')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'code' => $code,
            'name' => $payload['name'],
            'address_line' => $payload['address_line'] ?? null,
            'city' => $payload['city'] ?? null,
            'postal_code' => $payload['postal_code'] ?? null,
            'province' => $payload['province'] ?? null,
            'country' => $payload['country'] ?? 'ES',
            'contact_name' => $payload['contact_name'] ?? null,
            'contact_phone' => $payload['contact_phone'] ?? null,
            'contact_email' => $payload['contact_email'] ?? null,
            'manager_name' => $payload['manager_name'] ?? null,
            'opening_hours' => $payload['opening_hours'] ?? null,
            'latitude' => $payload['latitude'] ?? null,
            'longitude' => $payload['longitude'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'is_active' => $payload['is_active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
        $this->auditLogWriter->write($actor->id, 'depots.created', [
            'depot_id' => $id,
            'hub_id' => $payload['hub_id'],
            'depot_code' => $code,
        ]);

        return response()->json(['data' => DB::table('depots')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('depots.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('depots')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Depot not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'code' => ['sometimes', 'string', 'max:40', 'unique:depots,code,' . $id . ',id'],
            'name' => ['sometimes', 'string', 'max:120'],
            'address_line' => ['sometimes', 'nullable', 'string', 'max:220'],
            'city' => ['sometimes', 'nullable', 'string', 'max:80'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'province' => ['sometimes', 'nullable', 'string', 'max:80'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'contact_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:160'],
            'manager_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'opening_hours' => ['sometimes', 'nullable', 'string', 'max:120'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        DB::table('depots')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'depots.updated', [
            'depot_id' => $id,
            'changes' => array_keys($payload),
        ]);

        return response()->json(['data' => DB::table('depots')->where('id', $id)->whereNull('deleted_at')->first()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('depots.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('depots')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Depot not found.'],
            ], 404);
        }

        $linkedPoints = DB::table('points')->where('depot_id', $id)->whereNull('deleted_at')->count();
        if ($linkedPoints > 0) {
            return response()->json([
                'error' => [
                    'code' => 'RESOURCE_CONFLICT',
                    'message' => 'Depot has linked points and cannot be deleted.',
                    'details' => ['blocked_by' => ['points']],
                ],
            ], 409);
        }

        DB::table('depots')->where('id', $id)->update([
            'deleted_at' => now(),
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'depots.deleted', [
            'depot_id' => $id,
        ]);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }

    public function restore(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('depots.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('depots')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Depot not found.'],
            ], 404);
        }
        if ($row->deleted_at === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_CONFLICT', 'message' => 'Depot is already active.'],
            ], 409);
        }
        if (!DB::table('hubs')->where('id', $row->hub_id)->whereNull('deleted_at')->exists()) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_CONFLICT', 'message' => 'Cannot restore depot while parent hub is archived.'],
            ], 409);
        }

        DB::table('depots')->where('id', $id)->update([
            'deleted_at' => null,
            'updated_at' => now(),
        ]);
        $this->auditLogWriter->write($actor->id, 'depots.restored', [
            'depot_id' => $id,
        ]);

        return response()->json(['data' => DB::table('depots')->where('id', $id)->first()]);
    }
}
