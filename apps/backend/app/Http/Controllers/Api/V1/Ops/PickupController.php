<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class PickupController extends Controller
{
    public function __construct(private readonly SequenceService $sequenceService) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('pickups.read')) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => DB::table('pickups')->orderByDesc('created_at')->limit(100)->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('pickups.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'hub_id' => ['required', 'uuid'],
            'external_reference' => ['nullable', 'string', 'max:80'],
            'pickup_type' => ['required', 'in:NORMAL,RETURN'],
            'requester_name' => ['required', 'string', 'max:120'],
            'address_line' => ['required', 'string', 'max:220'],
            'scheduled_at' => [
                'required',
                'date',
                'after_or_equal:' . Carbon::now()->subDays(30)->format('Y-m-d H:i:s'),
                'before_or_equal:' . Carbon::now()->addDays(180)->format('Y-m-d H:i:s'),
            ],
        ]);

        $id = (string) Str::uuid();
        $reference = (string) $this->sequenceService->next('pickups');
        DB::table('pickups')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'reference' => $reference,
            'external_reference' => $payload['external_reference'] ?? null,
            'pickup_type' => $payload['pickup_type'],
            'requester_name' => $payload['requester_name'] ?? null,
            'address_line' => $payload['address_line'] ?? null,
            'scheduled_at' => $payload['scheduled_at'] ?? null,
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('pickups')->where('id', $id)->first()], 201);
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('pickups.write')) {
            return $this->forbidden();
        }

        $updated = DB::table('pickups')->where('id', $id)->update([
            'status' => 'completed',
            'completed_at' => now(),
            'updated_at' => now(),
        ]);

        if (!$updated) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Pickup not found.'],
            ], 404);
        }

        return response()->json(['data' => DB::table('pickups')->where('id', $id)->first()]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}
