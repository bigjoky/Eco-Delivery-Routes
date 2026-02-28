<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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
            'undo_of_stop_id' => ['nullable', 'uuid'],
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
        $this->writeRouteAudit($actor, $id, !empty($payload['undo_of_stop_id']) ? 'route.stop.undo_restored' : 'route.stop.added', [
            'stop_id' => $stopId,
            'undo_of_stop_id' => $payload['undo_of_stop_id'] ?? null,
            'sequence' => (int) $payload['sequence'],
            'stop_type' => $payload['stop_type'],
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
            $this->writeRouteAudit($actor, $id, 'route.stop.updated', [
                'stop_id' => $stopId,
                'payload' => $payload,
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
        $this->writeRouteAudit($actor, $id, 'route.stop.deleted', [
            'stop_id' => $stopId,
        ]);

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
        $this->writeRouteAudit($actor, $id, 'route.stops.reordered', [
            'stop_ids' => $providedIds,
        ]);

        return response()->json([
            'data' => $this->fetchRouteStops($id),
        ]);
    }

    public function bulkAddStops(Request $request, string $id): JsonResponse
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
            'shipment_ids' => ['nullable', 'array'],
            'shipment_ids.*' => ['required', 'uuid', 'exists:shipments,id'],
            'pickup_ids' => ['nullable', 'array'],
            'pickup_ids.*' => ['required', 'uuid', 'exists:pickups,id'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
        ]);

        $shipmentIds = array_values(array_unique($payload['shipment_ids'] ?? []));
        $pickupIds = array_values(array_unique($payload['pickup_ids'] ?? []));
        if ($shipmentIds === [] && $pickupIds === []) {
            throw ValidationException::withMessages([
                'shipment_ids' => ['Provide at least one shipment_id or pickup_id.'],
            ]);
        }

        $existingShipmentIds = DB::table('route_stops')
            ->where('route_id', $id)
            ->whereNotNull('shipment_id')
            ->pluck('shipment_id')
            ->all();
        $existingPickupIds = DB::table('route_stops')
            ->where('route_id', $id)
            ->whereNotNull('pickup_id')
            ->pluck('pickup_id')
            ->all();

        $newShipmentIds = array_values(array_diff($shipmentIds, $existingShipmentIds));
        $newPickupIds = array_values(array_diff($pickupIds, $existingPickupIds));
        $skippedCount = (count($shipmentIds) - count($newShipmentIds)) + (count($pickupIds) - count($newPickupIds));

        $createdCount = 0;
        DB::transaction(function () use ($id, $payload, $newShipmentIds, $newPickupIds, &$createdCount): void {
            $nextSequence = (int) DB::table('route_stops')->where('route_id', $id)->max('sequence');
            foreach ($newShipmentIds as $shipmentId) {
                $nextSequence++;
                DB::table('route_stops')->insert([
                    'id' => (string) Str::uuid(),
                    'route_id' => $id,
                    'sequence' => $nextSequence,
                    'stop_type' => 'DELIVERY',
                    'shipment_id' => $shipmentId,
                    'pickup_id' => null,
                    'status' => $payload['status'] ?? 'planned',
                    'planned_at' => null,
                    'completed_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $createdCount++;
            }
            foreach ($newPickupIds as $pickupId) {
                $nextSequence++;
                DB::table('route_stops')->insert([
                    'id' => (string) Str::uuid(),
                    'route_id' => $id,
                    'sequence' => $nextSequence,
                    'stop_type' => 'PICKUP',
                    'shipment_id' => null,
                    'pickup_id' => $pickupId,
                    'status' => $payload['status'] ?? 'planned',
                    'planned_at' => null,
                    'completed_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $createdCount++;
            }
        });
        $this->writeRouteAudit($actor, $id, 'route.stops.bulk_added', [
            'requested_shipments_count' => count($shipmentIds),
            'requested_pickups_count' => count($pickupIds),
            'created_count' => $createdCount,
            'skipped_existing_count' => $skippedCount,
        ]);

        return response()->json([
            'data' => [
                'created_count' => $createdCount,
                'skipped_existing_count' => $skippedCount,
                'stops' => $this->fetchRouteStops($id),
            ],
        ]);
    }

    public function manifest(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return $this->forbidden();
        }

        $payload = $this->buildManifestPayload($id);
        if ($payload === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        return response()->json(['data' => $payload]);
    }

    public function manifestExportCsv(Request $request, string $id): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return $this->forbidden();
        }

        $payload = $this->buildManifestPayload($id);
        if ($payload === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        $rows = [];
        $rows[] = 'route_code,route_date,status,driver_code,vehicle_code,sequence,stop_type,reference,stop_status';
        foreach ($payload['stops'] as $stop) {
            $rows[] = implode(',', [
                $this->csvValue((string) $payload['route']->code),
                $this->csvValue((string) $payload['route']->route_date),
                $this->csvValue((string) $payload['route']->status),
                $this->csvValue((string) ($payload['route']->driver_code ?? '')),
                $this->csvValue((string) ($payload['route']->vehicle_code ?? '')),
                (int) $stop->sequence,
                $this->csvValue((string) $stop->stop_type),
                $this->csvValue((string) ($stop->reference ?? $stop->entity_id)),
                $this->csvValue((string) $stop->status),
            ]);
        }

        $this->writeRouteAudit($actor, $id, 'route.manifest.exported.csv', [
            'rows_count' => count($payload['stops']),
        ]);

        return response(implode("\n", $rows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="route_manifest_' . $id . '.csv"',
        ]);
    }

    public function manifestExportPdf(Request $request, string $id): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return $this->forbidden();
        }

        $payload = $this->buildManifestPayload($id);
        if ($payload === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Route not found.'],
            ], 404);
        }

        $lines = [
            'Eco Delivery Routes - Route Manifest',
            sprintf(
                '%s | %s | status=%s | driver=%s | vehicle=%s',
                (string) $payload['route']->code,
                (string) $payload['route']->route_date,
                (string) $payload['route']->status,
                (string) ($payload['route']->driver_code ?? '-'),
                (string) ($payload['route']->vehicle_code ?? '-')
            ),
            sprintf(
                'Totals: stops=%d deliveries=%d pickups=%d completed=%d',
                (int) $payload['totals']['stops'],
                (int) $payload['totals']['deliveries'],
                (int) $payload['totals']['pickups'],
                (int) $payload['totals']['completed']
            ),
            '---',
        ];
        foreach ($payload['stops'] as $stop) {
            $lines[] = sprintf(
                '#%d %s %s (%s)',
                (int) $stop->sequence,
                (string) $stop->stop_type,
                (string) ($stop->reference ?? $stop->entity_id),
                (string) $stop->status
            );
        }

        $this->writeRouteAudit($actor, $id, 'route.manifest.exported.pdf', [
            'rows_count' => count($payload['stops']),
        ]);

        return response($this->buildSimplePdf($lines), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="route_manifest_' . $id . '.pdf"',
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

    /**
     * @return array{route: object, totals: array{stops:int,deliveries:int,pickups:int,completed:int}, stops: array<int, object>, generated_at: string}|null
     */
    private function buildManifestPayload(string $routeId): ?array
    {
        $route = DB::table('routes')
            ->leftJoin('drivers', 'drivers.id', '=', 'routes.driver_id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'routes.vehicle_id')
            ->where('routes.id', $routeId)
            ->select(
                'routes.id',
                'routes.code',
                'routes.route_date',
                'routes.status',
                'drivers.code as driver_code',
                'vehicles.code as vehicle_code'
            )
            ->first();
        if (!$route) {
            return null;
        }

        $stops = $this->fetchRouteStops($routeId);
        $deliveries = 0;
        $pickups = 0;
        $completed = 0;
        foreach ($stops as $stop) {
            if ($stop->stop_type === 'DELIVERY') {
                $deliveries++;
            } else {
                $pickups++;
            }
            if ($stop->status === 'completed') {
                $completed++;
            }
        }

        return [
            'route' => $route,
            'totals' => [
                'stops' => count($stops),
                'deliveries' => $deliveries,
                'pickups' => $pickups,
                'completed' => $completed,
            ],
            'stops' => $stops,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function writeRouteAudit(User $actor, string $routeId, string $event, array $metadata = []): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => $event,
            'metadata' => json_encode([
                'resource_type' => 'route',
                'resource_id' => $routeId,
                ...$metadata,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function csvValue(string $value): string
    {
        $escaped = str_replace('"', '""', $value);
        return '"' . $escaped . '"';
    }

    /**
     * @param array<int, string> $lines
     */
    private function buildSimplePdf(array $lines): string
    {
        $safeLines = array_map(static function (string $line): string {
            return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line);
        }, $lines);

        $fontSize = 11;
        $leading = 14;
        $startY = 800;
        $commands = ['BT', '/F1 ' . $fontSize . ' Tf', '72 ' . $startY . ' Td'];
        foreach ($safeLines as $idx => $line) {
            if ($idx > 0) {
                $commands[] = '0 -' . $leading . ' Td';
            }
            $commands[] = '(' . $line . ') Tj';
        }
        $commands[] = 'ET';
        $content = implode("\n", $commands) . "\n";
        $length = strlen($content);

        $objects = [];
        $objects[] = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';
        $objects[] = '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj';
        $objects[] = '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj';
        $objects[] = "4 0 obj << /Length {$length} >> stream\n{$content}endstream endobj";
        $objects[] = '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object . "\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n";
        $pdf .= '0 ' . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf('%010d 00000 n ', $offset) . "\n";
        }
        $pdf .= 'trailer << /Size ' . (count($objects) + 1) . ' /Root 1 0 R >>' . "\n";
        $pdf .= "startxref\n";
        $pdf .= $xrefOffset . "\n";
        $pdf .= "%%EOF";

        return $pdf;
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}
