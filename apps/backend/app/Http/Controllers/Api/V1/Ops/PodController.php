<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PodController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $start = microtime(true);
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('pods.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'evidenceable_type' => ['required', 'in:shipment,pickup'],
            'evidenceable_id' => ['required', 'uuid'],
            'signature_name' => ['nullable', 'string', 'max:120'],
            'photo_url' => ['nullable', 'string', 'max:255'],
            'geo_lat' => ['nullable', 'numeric'],
            'geo_lng' => ['nullable', 'numeric'],
        ]);

        $id = (string) Str::uuid();
        DB::table('pods')->insert([
            'id' => $id,
            'evidenceable_type' => $payload['evidenceable_type'],
            'evidenceable_id' => $payload['evidenceable_id'],
            'signature_name' => $payload['signature_name'] ?? null,
            'photo_url' => $payload['photo_url'] ?? null,
            'geo_lat' => $payload['geo_lat'] ?? null,
            'geo_lng' => $payload['geo_lng'] ?? null,
            'captured_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Log::info('ops.pod.created', [
            'actor_user_id' => $actor->id,
            'evidenceable_type' => $payload['evidenceable_type'],
            'evidenceable_id' => $payload['evidenceable_id'],
            'latency_ms' => (int) round((microtime(true) - $start) * 1000),
        ]);

        return response()->json(['data' => DB::table('pods')->where('id', $id)->first()], 201);
    }
}
