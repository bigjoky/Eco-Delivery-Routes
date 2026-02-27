<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TrackingEventController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $start = microtime(true);
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('tracking.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'trackable_type' => ['required', 'in:shipment,parcel,pickup'],
            'trackable_id' => ['required', 'uuid'],
            'event_code' => ['required', 'string', 'max:80'],
            'status_to' => ['nullable', 'string', 'max:40'],
            'scan_code' => ['nullable', 'string', 'max:120'],
            'source' => ['nullable', 'string', 'max:40'],
            'metadata' => ['nullable', 'array'],
            'occurred_at' => ['required', 'date'],
        ]);

        $id = DB::table('tracking_events')->insertGetId([
            'trackable_type' => $payload['trackable_type'],
            'trackable_id' => $payload['trackable_id'],
            'event_code' => $payload['event_code'],
            'status_to' => $payload['status_to'] ?? null,
            'scan_code' => $payload['scan_code'] ?? null,
            'source' => $payload['source'] ?? 'driver_app',
            'metadata' => isset($payload['metadata']) ? json_encode($payload['metadata']) : null,
            'occurred_at' => $payload['occurred_at'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Log::info('ops.tracking_event.created', [
            'actor_user_id' => $actor->id,
            'trackable_type' => $payload['trackable_type'],
            'trackable_id' => $payload['trackable_id'],
            'latency_ms' => (int) round((microtime(true) - $start) * 1000),
        ]);

        return response()->json(['data' => DB::table('tracking_events')->where('id', $id)->first()], 201);
    }
}
