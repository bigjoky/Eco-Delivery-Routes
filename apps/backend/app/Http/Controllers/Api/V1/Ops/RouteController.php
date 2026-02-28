<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RouteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return $this->forbidden();
        }

        $status = $request->query('status');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $driverId = null;

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
        }

        $applyFilters = function ($query) use ($status, $dateFrom, $dateTo, $driverId): void {
            if (is_string($status) && $status !== '') {
                $query->where('routes.status', $status);
            }
            if (is_string($dateFrom) && $dateFrom !== '') {
                $query->whereDate('routes.route_date', '>=', $dateFrom);
            }
            if (is_string($dateTo) && $dateTo !== '') {
                $query->whereDate('routes.route_date', '<=', $dateTo);
            }
            if ($driverId) {
                $query->where('routes.driver_id', $driverId);
            }
        };

        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $sort = (string) $request->query('sort', 'route_date');
        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['route_date', 'code', 'status', 'created_at'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'route_date';
        }

        $totalQuery = DB::table('routes');
        $applyFilters($totalQuery);
        $total = $totalQuery->count();

        $itemsQuery = DB::table('routes')
            ->leftJoin('drivers', 'drivers.id', '=', 'routes.driver_id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'routes.vehicle_id')
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->select(
                'routes.*',
                DB::raw('max(drivers.code) as driver_code'),
                DB::raw('max(vehicles.code) as vehicle_code'),
                DB::raw('count(route_stops.id) as stops_count')
            )
            ->groupBy('routes.id');
        $applyFilters($itemsQuery);

        $items = $itemsQuery
            ->orderBy("routes.$sort", $dir)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        return response()->json([
            'data' => $items,
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
        if (!$actor->hasPermission('routes.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'hub_id' => ['required', 'uuid', 'exists:hubs,id'],
            'code' => ['required', 'string', 'max:60'],
            'route_date' => ['required', 'date'],
            'driver_id' => ['nullable', 'uuid', 'exists:drivers,id'],
            'subcontractor_id' => ['nullable', 'uuid', 'exists:subcontractors,id'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'],
        ]);
        $this->assertAssignmentConsistency($payload);

        $id = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'code' => $payload['code'],
            'route_date' => $payload['route_date'],
            'driver_id' => $payload['driver_id'] ?? null,
            'subcontractor_id' => $payload['subcontractor_id'] ?? null,
            'vehicle_id' => $payload['vehicle_id'] ?? null,
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => $this->fetchRouteWithAssignments($id)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $id)->first();
        if (!$route) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'driver_id' => ['nullable', 'uuid', 'exists:drivers,id'],
            'subcontractor_id' => ['nullable', 'uuid', 'exists:subcontractors,id'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
        ]);
        $merged = [
            'driver_id' => array_key_exists('driver_id', $payload) ? $payload['driver_id'] : $route->driver_id,
            'subcontractor_id' => array_key_exists('subcontractor_id', $payload) ? $payload['subcontractor_id'] : $route->subcontractor_id,
            'vehicle_id' => array_key_exists('vehicle_id', $payload) ? $payload['vehicle_id'] : $route->vehicle_id,
        ];
        $this->assertAssignmentConsistency($merged);

        if ($payload === []) {
            return response()->json(['data' => $this->fetchRouteWithAssignments($id)]);
        }

        DB::table('routes')
            ->where('id', $id)
            ->update([
                ...$payload,
                'updated_at' => now(),
            ]);

        return response()->json(['data' => $this->fetchRouteWithAssignments($id)]);
    }

    private function fetchRouteWithAssignments(string $id): ?object
    {
        return DB::table('routes')
            ->leftJoin('drivers', 'drivers.id', '=', 'routes.driver_id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'routes.vehicle_id')
            ->where('routes.id', $id)
            ->select(
                'routes.*',
                DB::raw('drivers.code as driver_code'),
                DB::raw('vehicles.code as vehicle_code')
            )
            ->first();
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function assertAssignmentConsistency(array $payload): void
    {
        $driver = null;
        $vehicle = null;
        if (!empty($payload['driver_id'])) {
            $driver = DB::table('drivers')
                ->where('id', $payload['driver_id'])
                ->first(['id', 'subcontractor_id']);
        }
        if (!empty($payload['vehicle_id'])) {
            $vehicle = DB::table('vehicles')
                ->where('id', $payload['vehicle_id'])
                ->first(['id', 'subcontractor_id', 'assigned_driver_id']);
        }

        $subcontractorId = $payload['subcontractor_id'] ?? null;
        if ($subcontractorId && $driver && $driver->subcontractor_id && $driver->subcontractor_id !== $subcontractorId) {
            throw ValidationException::withMessages([
                'driver_id' => ['Driver does not belong to selected subcontractor.'],
            ]);
        }
        if ($subcontractorId && $vehicle && $vehicle->subcontractor_id && $vehicle->subcontractor_id !== $subcontractorId) {
            throw ValidationException::withMessages([
                'vehicle_id' => ['Vehicle does not belong to selected subcontractor.'],
            ]);
        }
        if ($driver && $vehicle && $driver->subcontractor_id && $vehicle->subcontractor_id && $driver->subcontractor_id !== $vehicle->subcontractor_id) {
            throw ValidationException::withMessages([
                'vehicle_id' => ['Vehicle subcontractor must match driver subcontractor.'],
            ]);
        }
        if ($driver && $vehicle && $vehicle->assigned_driver_id && $vehicle->assigned_driver_id !== $driver->id) {
            throw ValidationException::withMessages([
                'vehicle_id' => ['Vehicle is assigned to a different driver.'],
            ]);
        }
    }

    public function stops(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $id)->first();
        if (!$route) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        if ($actor->hasRole('driver')) {
            $driverId = DB::table('drivers')->where('user_id', $actor->id)->value('id');
            if (!$driverId || $route->driver_id !== $driverId) {
                return $this->forbidden();
            }
        }

        return response()->json([
            'data' => $this->fetchRouteStops($id),
        ]);
    }

    public function addStop(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $id)->first();
        if (!$route) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'sequence' => ['required', 'integer', 'min:1'],
            'stop_type' => ['required', 'in:DELIVERY,PICKUP'],
            'shipment_id' => ['nullable', 'uuid', 'exists:shipments,id'],
            'pickup_id' => ['nullable', 'uuid', 'exists:pickups,id'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
            'planned_at' => ['nullable', 'date'],
        ]);
        $this->assertStopPayloadConsistency($payload);
        $this->assertUniqueStopSequence($id, (int) $payload['sequence']);

        $stopId = (string) Str::uuid();
        DB::table('route_stops')->insert([
            'id' => $stopId,
            'route_id' => $id,
            'sequence' => $payload['sequence'],
            'stop_type' => $payload['stop_type'],
            'shipment_id' => $payload['shipment_id'] ?? null,
            'pickup_id' => $payload['pickup_id'] ?? null,
            'status' => $payload['status'] ?? 'planned',
            'planned_at' => $payload['planned_at'] ?? null,
            'completed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => $this->fetchStopById($stopId),
        ], 201);
    }

    public function updateStop(Request $request, string $id, string $stopId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $id)->first();
        if (!$route) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        $existing = DB::table('route_stops')->where('id', $stopId)->where('route_id', $id)->first();
        if (!$existing) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route stop not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'sequence' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
            'planned_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
        ]);
        if (array_key_exists('sequence', $payload) && $payload['sequence'] !== null) {
            $this->assertUniqueStopSequence($id, (int) $payload['sequence'], $stopId);
        }

        if ($payload !== []) {
            DB::table('route_stops')
                ->where('id', $stopId)
                ->where('route_id', $id)
                ->update([
                    ...$payload,
                    'updated_at' => now(),
                ]);
        }

        return response()->json([
            'data' => $this->fetchStopById($stopId),
        ]);
    }

    public function deleteStop(Request $request, string $id, string $stopId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $id)->first();
        if (!$route) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        $existing = DB::table('route_stops')->where('id', $stopId)->where('route_id', $id)->first();
        if (!$existing) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route stop not found.'],
            ], 404);
        }

        DB::transaction(function () use ($id, $stopId): void {
            DB::table('route_stops')
                ->where('id', $stopId)
                ->where('route_id', $id)
                ->delete();

            $remaining = DB::table('route_stops')
                ->where('route_id', $id)
                ->orderBy('sequence')
                ->orderBy('id')
                ->get(['id']);

            foreach ($remaining as $index => $row) {
                DB::table('route_stops')
                    ->where('id', $row->id)
                    ->update([
                        'sequence' => $index + 1,
                        'updated_at' => now(),
                    ]);
            }
        });

        return response()->json([
            'data' => $this->fetchRouteStops($id),
        ]);
    }

    public function reorderStops(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $id)->first();
        if (!$route) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'stop_ids' => ['required', 'array', 'min:1'],
            'stop_ids.*' => ['required', 'uuid'],
        ]);

        $existingIds = DB::table('route_stops')
            ->where('route_id', $id)
            ->pluck('id')
            ->all();
        $providedIds = $payload['stop_ids'];
        sort($existingIds);
        $sortedProvided = $providedIds;
        sort($sortedProvided);
        if ($existingIds !== $sortedProvided) {
            throw ValidationException::withMessages([
                'stop_ids' => ['stop_ids must include exactly all route stop ids.'],
            ]);
        }

        DB::transaction(function () use ($id, $providedIds): void {
            foreach ($providedIds as $index => $stopId) {
                DB::table('route_stops')
                    ->where('route_id', $id)
                    ->where('id', $stopId)
                    ->update([
                        'sequence' => $index + 1,
                        'updated_at' => now(),
                    ]);
            }
        });

        return response()->json([
            'data' => $this->fetchRouteStops($id),
        ]);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function assertStopPayloadConsistency(array $payload): void
    {
        if ($payload['stop_type'] === 'DELIVERY') {
            if (empty($payload['shipment_id']) || !empty($payload['pickup_id'])) {
                throw ValidationException::withMessages([
                    'shipment_id' => ['Delivery stop requires shipment_id and must not include pickup_id.'],
                ]);
            }
            return;
        }

        if (empty($payload['pickup_id']) || !empty($payload['shipment_id'])) {
            throw ValidationException::withMessages([
                'pickup_id' => ['Pickup stop requires pickup_id and must not include shipment_id.'],
            ]);
        }
    }

    private function assertUniqueStopSequence(string $routeId, int $sequence, ?string $ignoreStopId = null): void
    {
        $query = DB::table('route_stops')
            ->where('route_id', $routeId)
            ->where('sequence', $sequence);

        if ($ignoreStopId) {
            $query->where('id', '!=', $ignoreStopId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'sequence' => ['Sequence already exists for this route.'],
            ]);
        }
    }

    private function fetchStopById(string $stopId): ?object
    {
        return DB::table('route_stops')
            ->leftJoin('shipments', 'shipments.id', '=', 'route_stops.shipment_id')
            ->leftJoin('pickups', 'pickups.id', '=', 'route_stops.pickup_id')
            ->where('route_stops.id', $stopId)
            ->first([
                'route_stops.id',
                'route_stops.route_id',
                'route_stops.sequence',
                'route_stops.stop_type',
                'route_stops.shipment_id',
                'route_stops.pickup_id',
                'route_stops.status',
                'route_stops.planned_at',
                'route_stops.completed_at',
                'route_stops.created_at',
                'route_stops.updated_at',
                DB::raw("CASE WHEN route_stops.shipment_id IS NOT NULL THEN 'shipment' ELSE 'pickup' END as entity_type"),
                DB::raw('COALESCE(route_stops.shipment_id, route_stops.pickup_id) as entity_id'),
                DB::raw('COALESCE(shipments.reference, pickups.reference) as reference'),
            ]);
    }

    /**
     * @return array<int, object>
     */
    private function fetchRouteStops(string $routeId): array
    {
        return DB::table('route_stops')
            ->leftJoin('shipments', 'shipments.id', '=', 'route_stops.shipment_id')
            ->leftJoin('pickups', 'pickups.id', '=', 'route_stops.pickup_id')
            ->where('route_stops.route_id', $routeId)
            ->orderBy('route_stops.sequence')
            ->get([
                'route_stops.id',
                'route_stops.route_id',
                'route_stops.sequence',
                'route_stops.stop_type',
                'route_stops.shipment_id',
                'route_stops.pickup_id',
                'route_stops.status',
                'route_stops.planned_at',
                'route_stops.completed_at',
                'route_stops.created_at',
                'route_stops.updated_at',
                DB::raw("CASE WHEN route_stops.shipment_id IS NOT NULL THEN 'shipment' ELSE 'pickup' END as entity_type"),
                DB::raw('COALESCE(route_stops.shipment_id, route_stops.pickup_id) as entity_id'),
                DB::raw('COALESCE(shipments.reference, pickups.reference) as reference'),
            ])
            ->all();
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}
