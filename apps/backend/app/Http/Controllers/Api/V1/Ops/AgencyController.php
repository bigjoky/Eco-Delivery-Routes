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

class AgencyController extends Controller
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
            && !$actor->hasPermission('routes.read')
            && !$actor->hasPermission('shipments.read')
            && !$actor->hasPermission('shipments.write')
        ) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $query = DB::table('agencies')->orderBy('code');
        if (!$request->boolean('include_deleted', false)) {
            $query->whereNull('deleted_at');
        }
        if ($request->filled('hub_id')) {
            $query->where('hub_id', (string) $request->query('hub_id'));
        }

        return response()->json(['data' => $query->get()]);
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
            'hub_id' => ['nullable', 'uuid', 'exists:hubs,id'],
            'name' => ['required', 'string', 'max:160'],
            'legal_name' => ['nullable', 'string', 'max:180'],
            'tax_id' => ['nullable', 'string', 'max:60'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'city' => ['nullable', 'string', 'max:80'],
            'province' => ['nullable', 'string', 'max:80'],
            'country' => ['nullable', 'string', 'size:2'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'contact_email' => ['nullable', 'email', 'max:160'],
            'manager_name' => ['nullable', 'string', 'max:120'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (!empty($payload['hub_id']) && !DB::table('hubs')->where('id', $payload['hub_id'])->whereNull('deleted_at')->exists()) {
            return response()->json(['error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Hub not found.']], 422);
        }

        $id = (string) Str::uuid();
        $code = (string) $this->sequenceService->next('agencies');
        DB::table('agencies')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'] ?? null,
            'code' => $code,
            'name' => $payload['name'],
            'legal_name' => $payload['legal_name'] ?? null,
            'tax_id' => $payload['tax_id'] ?? null,
            'address_line' => $payload['address_line'] ?? null,
            'postal_code' => $payload['postal_code'] ?? null,
            'city' => $payload['city'] ?? null,
            'province' => $payload['province'] ?? null,
            'country' => $payload['country'] ?? 'ES',
            'contact_name' => $payload['contact_name'] ?? null,
            'contact_phone' => $payload['contact_phone'] ?? null,
            'contact_email' => $payload['contact_email'] ?? null,
            'manager_name' => $payload['manager_name'] ?? null,
            'latitude' => $payload['latitude'] ?? null,
            'longitude' => $payload['longitude'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'is_active' => $payload['is_active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->auditLogWriter->write($actor->id, 'agencies.created', [
            'agency_id' => $id,
            'agency_code' => $code,
            'hub_id' => $payload['hub_id'] ?? null,
        ]);

        return response()->json(['data' => DB::table('agencies')->where('id', $id)->first()], 201);
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

        $row = DB::table('agencies')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Agency not found.']], 404);
        }

        $payload = $request->validate([
            'hub_id' => ['sometimes', 'nullable', 'uuid', 'exists:hubs,id'],
            'name' => ['sometimes', 'string', 'max:160'],
            'legal_name' => ['sometimes', 'nullable', 'string', 'max:180'],
            'tax_id' => ['sometimes', 'nullable', 'string', 'max:60'],
            'address_line' => ['sometimes', 'nullable', 'string', 'max:220'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'city' => ['sometimes', 'nullable', 'string', 'max:80'],
            'province' => ['sometimes', 'nullable', 'string', 'max:80'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'contact_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:160'],
            'manager_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        DB::table('agencies')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);

        $this->auditLogWriter->write($actor->id, 'agencies.updated', [
            'agency_id' => $id,
            'changes' => array_keys($payload),
        ]);

        return response()->json(['data' => DB::table('agencies')->where('id', $id)->whereNull('deleted_at')->first()]);
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

        $row = DB::table('agencies')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Agency not found.']], 404);
        }

        DB::table('agencies')->where('id', $id)->update([
            'deleted_at' => now(),
            'updated_at' => now(),
        ]);

        $this->auditLogWriter->write($actor->id, 'agencies.deleted', [
            'agency_id' => $id,
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

        $row = DB::table('agencies')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Agency not found.']], 404);
        }
        if ($row->deleted_at === null) {
            return response()->json(['error' => ['code' => 'RESOURCE_CONFLICT', 'message' => 'Agency is already active.']], 409);
        }

        DB::table('agencies')->where('id', $id)->update([
            'deleted_at' => null,
            'updated_at' => now(),
        ]);

        $this->auditLogWriter->write($actor->id, 'agencies.restored', [
            'agency_id' => $id,
        ]);

        return response()->json(['data' => DB::table('agencies')->where('id', $id)->first()]);
    }
}
