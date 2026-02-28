<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ShipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.read')) {
            return $this->forbidden();
        }

        $status = $request->query('status');
        $query = DB::table('shipments');

        if ($actor->hasRole('driver')) {
            $driverId = DB::table('drivers')->where('user_id', $actor->id)->value('id');
            if (!$driverId) {
                return response()->json([
                    'data' => [],
                    'meta' => [
                        'page' => 1,
                        'per_page' => 20,
                        'total' => 0,
                        'last_page' => 0,
                    ],
                ]);
            }
            $query->where('assigned_driver_id', $driverId);
        }

        if (is_string($status) && $status !== '') {
            $query->where('status', $status);
        }

        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $sort = (string) $request->query('sort', 'created_at');
        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSorts = ['created_at', 'scheduled_at', 'reference', 'status'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'created_at';
        }

        $total = (clone $query)->count();
        $rows = $query
            ->orderBy($sort, $dir)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'hub_id' => ['required', 'uuid'],
            'reference' => ['required', 'string', 'max:60'],
            'consignee_name' => ['nullable', 'string', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'scheduled_at' => ['nullable', 'date'],
        ]);

        $id = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'reference' => $payload['reference'],
            'consignee_name' => $payload['consignee_name'] ?? null,
            'address_line' => $payload['address_line'] ?? null,
            'scheduled_at' => $payload['scheduled_at'] ?? null,
            'status' => 'created',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('shipments')->where('id', $id)->first(),
        ], 201);
    }

    public function markDelivered(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $exists = DB::table('shipments')->where('id', $id)->exists();
        if (!$exists) {
            return $this->notFound('Shipment not found.');
        }

        DB::table('shipments')->where('id', $id)->update([
            'status' => 'delivered',
            'delivered_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('shipments')->where('id', $id)->first()]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => $message],
        ], 404);
    }
}
