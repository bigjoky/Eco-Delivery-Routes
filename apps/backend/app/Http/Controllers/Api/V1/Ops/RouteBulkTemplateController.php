<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RouteBulkTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $routeId = (string) $request->query('route_id', '');
        $query = DB::table('route_bulk_action_templates')
            ->where('user_id', $actor->id)
            ->orderByDesc('updated_at');

        if ($routeId !== '') {
            $query->where(function ($inner) use ($routeId): void {
                $inner->where('route_id', $routeId)->orWhereNull('route_id');
            });
        }

        return response()->json(['data' => $query->limit(50)->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $payload = $request->validate([
            'route_id' => ['nullable', 'uuid', 'exists:routes,id'],
            'name' => ['required', 'string', 'max:120'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
            'planned_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
            'shift_minutes' => ['nullable', 'integer', 'between:-1440,1440'],
        ]);

        $id = (string) Str::uuid();
        DB::table('route_bulk_action_templates')->insert([
            'id' => $id,
            'user_id' => $actor->id,
            'route_id' => $payload['route_id'] ?? null,
            'name' => $payload['name'],
            'status' => $payload['status'] ?? null,
            'planned_at' => $payload['planned_at'] ?? null,
            'completed_at' => $payload['completed_at'] ?? null,
            'shift_minutes' => (int) ($payload['shift_minutes'] ?? 0),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('route_bulk_action_templates')->where('id', $id)->first()], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $template = DB::table('route_bulk_action_templates')
            ->where('id', $id)
            ->where('user_id', $actor->id)
            ->first();
        if (!$template) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Template not found.']], 404);
        }

        DB::table('route_bulk_action_templates')->where('id', $id)->delete();
        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $template = DB::table('route_bulk_action_templates')
            ->where('id', $id)
            ->where('user_id', $actor->id)
            ->first();
        if (!$template) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Template not found.']], 404);
        }

        $payload = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
            'planned_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
            'shift_minutes' => ['nullable', 'integer', 'between:-1440,1440'],
        ]);

        if ($payload === []) {
            return response()->json(['data' => $template]);
        }

        DB::table('route_bulk_action_templates')
            ->where('id', $id)
            ->update([
                ...$payload,
                'updated_at' => now(),
            ]);

        return response()->json(['data' => DB::table('route_bulk_action_templates')->where('id', $id)->first()]);
    }

    public function duplicate(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $template = DB::table('route_bulk_action_templates')
            ->where('id', $id)
            ->where('user_id', $actor->id)
            ->first();
        if (!$template) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Template not found.']], 404);
        }

        $newId = (string) Str::uuid();
        DB::table('route_bulk_action_templates')->insert([
            'id' => $newId,
            'user_id' => $actor->id,
            'route_id' => $template->route_id,
            'name' => ((string) $template->name) . ' (copia)',
            'status' => $template->status,
            'planned_at' => $template->planned_at,
            'completed_at' => $template->completed_at,
            'shift_minutes' => (int) ($template->shift_minutes ?? 0),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('route_bulk_action_templates')->where('id', $newId)->first()], 201);
    }
}
