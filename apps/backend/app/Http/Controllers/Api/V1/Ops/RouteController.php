<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RouteController extends Controller
{
    public function __construct(private readonly SequenceService $sequenceService) {}

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
        $hubId = $request->query('hub_id');
        $search = $request->query('q');
        $subcontractorId = $request->query('subcontractor_id');
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

        $applyFilters = function ($query) use ($status, $dateFrom, $dateTo, $hubId, $search, $driverId, $subcontractorId): void {
            if (is_string($status) && $status !== '') {
                $query->where('routes.status', $status);
            }
            if (is_string($hubId) && $hubId !== '') {
                $query->where('routes.hub_id', $hubId);
            }
            if (is_string($subcontractorId) && $subcontractorId !== '') {
                $query->where('routes.subcontractor_id', $subcontractorId);
            }
            if (is_string($search) && $search !== '') {
                $like = '%' . str_replace('%', '\\%', $search) . '%';
                $query->where('routes.code', 'like', $like);
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
                DB::raw('max(vehicles.plate_number) as vehicle_code'),
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
            'route_date' => ['required', 'date'],
            'driver_id' => ['nullable', 'uuid', 'exists:drivers,id'],
            'subcontractor_id' => ['nullable', 'uuid', 'exists:subcontractors,id'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'],
        ]);
        $this->assertAssignmentConsistency($payload);

        $id = (string) Str::uuid();
        $code = $this->generateRouteCode((string) $payload['hub_id'], (string) $payload['route_date']);
        DB::table('routes')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'code' => $code,
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

    private function generateRouteCode(string $hubId, string $routeDate): string
    {
        $hubCode = (string) DB::table('hubs')->where('id', $hubId)->value('code');
        $hubToken = strtoupper((string) preg_replace('/[^A-Z0-9]/', '', $hubCode));
        $hubToken = substr($hubToken !== '' ? $hubToken : 'GEN', 0, 8);
        $dateToken = str_replace('-', '', $routeDate);
        $sequence = str_pad((string) $this->sequenceService->next(sprintf('routes:%s:%s', $dateToken, $hubToken)), 3, '0', STR_PAD_LEFT);

        return sprintf('R-%s-%s-%s', $dateToken, $hubToken, $sequence);
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
            'route_id' => $route->id,
            'route_date' => $route->route_date,
        ];
        $assessment = $this->assessAssignmentConsistency($merged);
        if ($assessment['errors'] !== []) {
            /** @var array{field:string,message:string} $first */
            $first = $assessment['errors'][0];
            $this->throwValidationError($first['message'], $first['field']);
        }
        $nextStatus = (string) ($payload['status'] ?? $route->status);
        $isPublishTransition = $route->status === 'planned' && $nextStatus === 'in_progress';
        if ($isPublishTransition) {
            $this->assertPublishAllowedByPolicy($actor, $assessment['warnings']);
        }

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

    public function assignmentPreview(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'driver_id' => ['nullable', 'uuid', 'exists:drivers,id'],
            'subcontractor_id' => ['nullable', 'uuid', 'exists:subcontractors,id'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'],
            'route_id' => ['nullable', 'uuid', 'exists:routes,id'],
            'route_date' => ['nullable', 'date'],
        ]);

        $assessment = $this->assessAssignmentConsistency($payload);
        return response()->json([
            'data' => [
                'valid' => count($assessment['errors']) === 0,
                'conflicts' => $assessment['errors'],
                'warnings' => $assessment['warnings'],
                'recommended_subcontractor_id' => $assessment['recommended_subcontractor_id'],
            ],
        ]);
    }

    public function assignmentPublishPolicy(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => $this->resolvePublishPolicy(),
        ]);
    }

    public function upsertAssignmentPublishPolicy(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'enforce_on_publish' => ['required', 'boolean'],
            'critical_warning_codes' => ['required', 'array', 'min:1'],
            'critical_warning_codes.*' => ['required', 'string', 'max:80'],
            'bypass_role_codes' => ['required', 'array', 'min:1'],
            'bypass_role_codes.*' => ['required', 'string', 'max:80'],
        ]);

        DB::table('route_assignment_policies')->updateOrInsert(
            ['id' => 1],
            [
                'enforce_on_publish' => (bool) $payload['enforce_on_publish'],
                'critical_warning_codes' => json_encode(array_values(array_unique($payload['critical_warning_codes']))),
                'bypass_role_codes' => json_encode(array_values(array_unique($payload['bypass_role_codes']))),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json([
            'data' => $this->resolvePublishPolicy(),
            'message' => 'Assignment publish policy updated.',
        ]);
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
                DB::raw('vehicles.plate_number as vehicle_code')
            )
            ->first();
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function assertAssignmentConsistency(array $payload): void
    {
        $assessment = $this->assessAssignmentConsistency($payload);
        if ($assessment['errors'] !== []) {
            /** @var array{field:string,message:string} $first */
            $first = $assessment['errors'][0];
            $this->throwValidationError($first['message'], $first['field']);
        }
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{errors:array<int,array{field:string,message:string}>,warnings:array<int,array{field:string,message:string,code?:string}>,recommended_subcontractor_id:string|null}
     */
    private function assessAssignmentConsistency(array $payload): array
    {
        $driver = null;
        $vehicle = null;
        if (!empty($payload['driver_id'])) {
            $driver = DB::table('drivers')
                ->where('id', $payload['driver_id'])
                ->first(['id', 'subcontractor_id', 'status']);
        }
        if (!empty($payload['vehicle_id'])) {
            $vehicle = DB::table('vehicles')
                ->where('id', $payload['vehicle_id'])
                ->first(['id', 'subcontractor_id', 'assigned_driver_id', 'status', 'capacity_kg']);
        }

        $routeId = $payload['route_id'] ?? null;
        $routeDate = $payload['route_date'] ?? null;
        if (is_string($routeId) && $routeId !== '' && !$routeDate) {
            $routeDate = DB::table('routes')->where('id', $routeId)->value('route_date');
        }

        $subcontractorId = $payload['subcontractor_id'] ?? null;
        $recommendedSubcontractorId = $subcontractorId
            ?: ($driver->subcontractor_id ?? null)
            ?: ($vehicle->subcontractor_id ?? null);

        $errors = [];
        $warnings = [];
        if ($subcontractorId && $driver && $driver->subcontractor_id && $driver->subcontractor_id !== $subcontractorId) {
            $errors[] = ['field' => 'driver_id', 'message' => 'Driver does not belong to selected subcontractor.'];
        }
        if ($subcontractorId && $vehicle && $vehicle->subcontractor_id && $vehicle->subcontractor_id !== $subcontractorId) {
            $errors[] = ['field' => 'vehicle_id', 'message' => 'Vehicle does not belong to selected subcontractor.'];
        }
        if ($driver && $vehicle && $driver->subcontractor_id && $vehicle->subcontractor_id && $driver->subcontractor_id !== $vehicle->subcontractor_id) {
            $errors[] = ['field' => 'vehicle_id', 'message' => 'Vehicle subcontractor must match driver subcontractor.'];
        }
        if ($driver && $vehicle && $vehicle->assigned_driver_id && $vehicle->assigned_driver_id !== $driver->id) {
            $errors[] = ['field' => 'vehicle_id', 'message' => 'Vehicle is assigned to a different driver.'];
        }
        if ($driver && in_array($driver->status, ['inactive', 'suspended'], true)) {
            $errors[] = ['field' => 'driver_id', 'message' => 'Driver is not active.'];
        }
        if ($vehicle && in_array($vehicle->status, ['inactive', 'maintenance'], true)) {
            $errors[] = ['field' => 'vehicle_id', 'message' => 'Vehicle is not operational (inactive/maintenance).'];
        }

        if (is_string($routeDate) && $routeDate !== '') {
            if ($driver) {
                $driverBusy = DB::table('routes')
                    ->where('driver_id', $driver->id)
                    ->whereDate('route_date', $routeDate)
                    ->whereIn('status', ['planned', 'in_progress'])
                    ->when($routeId, fn ($q) => $q->where('id', '!=', $routeId))
                    ->exists();
                if ($driverBusy) {
                    $errors[] = ['field' => 'driver_id', 'message' => 'Driver already assigned to another active route on the same date.'];
                }
            }
            if ($vehicle) {
                $vehicleBusy = DB::table('routes')
                    ->where('vehicle_id', $vehicle->id)
                    ->whereDate('route_date', $routeDate)
                    ->whereIn('status', ['planned', 'in_progress'])
                    ->when($routeId, fn ($q) => $q->where('id', '!=', $routeId))
                    ->exists();
                if ($vehicleBusy) {
                    $errors[] = ['field' => 'vehicle_id', 'message' => 'Vehicle already assigned to another active route on the same date.'];
                }
            }
        }

        if ($routeId && $routeDate) {
            $windowRows = DB::table('route_stops')
                ->leftJoin('shipments', 'shipments.id', '=', 'route_stops.shipment_id')
                ->leftJoin('pickups', 'pickups.id', '=', 'route_stops.pickup_id')
                ->where('route_stops.route_id', $routeId)
                ->get([
                    'shipments.scheduled_at as shipment_scheduled_at',
                    'shipments.service_type as shipment_service_type',
                    'pickups.scheduled_at as pickup_scheduled_at',
                ]);
            $windowIssue = false;
            foreach ($windowRows as $windowRow) {
                if (
                    $windowRow->shipment_scheduled_at &&
                    !$this->isWithinAllowedWindow(
                        (string) $routeDate,
                        (string) $windowRow->shipment_scheduled_at,
                        $windowRow->shipment_service_type ? (string) $windowRow->shipment_service_type : null
                    )
                ) {
                    $windowIssue = true;
                    break;
                }
                if ($windowRow->pickup_scheduled_at && !$this->isWithinTwoDays((string) $routeDate, (string) $windowRow->pickup_scheduled_at)) {
                    $windowIssue = true;
                    break;
                }
            }
            if ($windowIssue) {
                $errors[] = ['field' => 'subcontractor_id', 'message' => 'Route contains stops outside allowed service time window.'];
            }
        }

        if ($routeId && $vehicle && $vehicle->capacity_kg) {
            $assignedShipmentIds = DB::table('route_stops')
                ->where('route_id', $routeId)
                ->whereNotNull('shipment_id')
                ->pluck('shipment_id')
                ->all();
            if ($assignedShipmentIds !== []) {
                $weightGrams = (int) DB::table('parcels')
                    ->whereIn('shipment_id', $assignedShipmentIds)
                    ->sum('weight_grams');
                $weightKg = $weightGrams / 1000;
                if ($weightKg > ((float) $vehicle->capacity_kg + 0.0001)) {
                    $errors[] = ['field' => 'vehicle_id', 'message' => 'Vehicle capacity is insufficient for current route load.'];
                }
            }
        }

        if ($driver) {
            $driverQuality = DB::table('quality_snapshots')
                ->where('scope_type', 'driver')
                ->where('scope_id', $driver->id)
                ->orderByDesc('period_end')
                ->value('service_quality_score');
            if (is_numeric($driverQuality) && (float) $driverQuality < 95.0) {
                $warnings[] = ['field' => 'driver_id', 'message' => 'Driver quality score is below 95%.', 'code' => 'LOW_DRIVER_QUALITY'];
            }
        }
        if ($recommendedSubcontractorId) {
            $subcontractorQuality = DB::table('quality_snapshots')
                ->where('scope_type', 'subcontractor')
                ->where('scope_id', $recommendedSubcontractorId)
                ->orderByDesc('period_end')
                ->value('service_quality_score');
            if (is_numeric($subcontractorQuality) && (float) $subcontractorQuality < 95.0) {
                $warnings[] = ['field' => 'subcontractor_id', 'message' => 'Subcontractor quality score is below 95%.', 'code' => 'LOW_SUBCONTRACTOR_QUALITY'];
            }
        }
        if ($vehicle && !$vehicle->capacity_kg) {
            $warnings[] = ['field' => 'vehicle_id', 'message' => 'Vehicle has no configured capacity_kg.', 'code' => 'MISSING_VEHICLE_CAPACITY'];
        }

        return [
            'errors' => $errors,
            'warnings' => $warnings,
            'recommended_subcontractor_id' => $recommendedSubcontractorId,
        ];
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
        $this->assertStopNotDuplicatedInRoute($route, $payload);
        $this->assertStopTemporalWindowConsistency($route, $payload);
        $this->assertRouteVehicleCapacityForStop($route, $payload);

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
            $this->throwValidationError('stop_ids must include exactly all route stop ids.', 'stop_ids');
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
            'expedition_ids' => ['nullable', 'array'],
            'expedition_ids.*' => ['required', 'uuid', 'exists:expeditions,id'],
            'shipment_ids' => ['nullable', 'array'],
            'shipment_ids.*' => ['required', 'uuid', 'exists:shipments,id'],
            'pickup_ids' => ['nullable', 'array'],
            'pickup_ids.*' => ['required', 'uuid', 'exists:pickups,id'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
        ]);

        $expeditionIds = array_values(array_unique($payload['expedition_ids'] ?? []));
        $expeditionLegs = $expeditionIds !== []
            ? DB::table('expeditions')
                ->whereIn('id', $expeditionIds)
                ->get(['id', 'shipment_id', 'pickup_id'])
            : collect();
        $shipmentIds = array_values(array_unique(array_merge(
            $payload['shipment_ids'] ?? [],
            $expeditionLegs->pluck('shipment_id')->filter()->values()->all()
        )));
        $pickupIds = array_values(array_unique(array_merge(
            $payload['pickup_ids'] ?? [],
            $expeditionLegs->pluck('pickup_id')->filter()->values()->all()
        )));
        if ($shipmentIds === [] && $pickupIds === []) {
            throw ValidationException::withMessages([
                'expedition_ids' => ['Provide at least one expedition_id, shipment_id or pickup_id.'],
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

        $this->assertBulkStopTemporalWindowConsistency($route, $newShipmentIds, $newPickupIds);
        $this->assertRouteVehicleCapacityForBulkStops($route, $newShipmentIds);

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
            'requested_expeditions_count' => count($expeditionIds),
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

    public function bulkUpdateStops(Request $request, string $id): JsonResponse
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
            'stop_ids' => ['required', 'array', 'min:1', 'max:500'],
            'stop_ids.*' => ['required', 'uuid'],
            'status' => ['nullable', 'in:planned,in_progress,completed'],
            'planned_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
            'eta_shift_minutes' => ['nullable', 'integer', 'min:-720', 'max:720'],
            'reason_code' => ['nullable', 'string', 'max:80'],
            'reason_detail' => ['nullable', 'string', 'max:255'],
        ]);

        $hasStatus = array_key_exists('status', $payload);
        $hasPlannedAt = array_key_exists('planned_at', $payload);
        $hasCompletedAt = array_key_exists('completed_at', $payload);
        $hasEtaShift = array_key_exists('eta_shift_minutes', $payload) && ((int) $payload['eta_shift_minutes']) !== 0;
        if (!$hasStatus && !$hasPlannedAt && !$hasCompletedAt && !$hasEtaShift) {
            $this->throwValidationError(
                'Provide at least one field to update (status, planned_at, completed_at, eta_shift_minutes).',
                'stop_ids'
            );
        }

        $stopIds = array_values(array_unique(array_map('strval', $payload['stop_ids'])));
        $stops = DB::table('route_stops')
            ->where('route_id', $id)
            ->whereIn('id', $stopIds)
            ->get(['id', 'planned_at', 'completed_at']);
        if ($stops->count() !== count($stopIds)) {
            $this->throwValidationError('Some stop_ids do not belong to this route.', 'stop_ids');
        }

        $updatedCount = 0;
        $etaShift = (int) ($payload['eta_shift_minutes'] ?? 0);

        DB::transaction(function () use (
            $id,
            $stopIds,
            $stops,
            $payload,
            $hasStatus,
            $hasPlannedAt,
            $hasCompletedAt,
            $hasEtaShift,
            $etaShift,
            &$updatedCount
        ): void {
            foreach ($stopIds as $stopId) {
                /** @var object{id:string,planned_at:?string,completed_at:?string} $current */
                $current = $stops->firstWhere('id', $stopId);
                $updatePayload = [
                    'updated_at' => now(),
                ];

                if ($hasStatus) {
                    $updatePayload['status'] = $payload['status'];
                }

                if ($hasPlannedAt) {
                    $updatePayload['planned_at'] = $payload['planned_at'];
                } elseif ($hasEtaShift) {
                    $updatePayload['planned_at'] = $this->shiftDateTime($current->planned_at, $etaShift);
                }

                if ($hasCompletedAt) {
                    $updatePayload['completed_at'] = $payload['completed_at'];
                } elseif ($hasEtaShift) {
                    $updatePayload['completed_at'] = $this->shiftDateTime($current->completed_at, $etaShift);
                }

                if ($hasStatus && $payload['status'] === 'completed' && !$hasCompletedAt && !$hasEtaShift && empty($current->completed_at)) {
                    $updatePayload['completed_at'] = now()->toDateTimeString();
                }

                DB::table('route_stops')
                    ->where('route_id', $id)
                    ->where('id', $stopId)
                    ->update($updatePayload);
                $updatedCount++;
            }
        });

        $this->writeRouteAudit($actor, $id, 'route.stops.bulk_updated', [
            'updated_count' => $updatedCount,
            'stop_ids' => $stopIds,
            'status' => $payload['status'] ?? null,
            'planned_at' => $payload['planned_at'] ?? null,
            'completed_at' => $payload['completed_at'] ?? null,
            'eta_shift_minutes' => $payload['eta_shift_minutes'] ?? null,
            'reason_code' => $payload['reason_code'] ?? null,
            'reason_detail' => $payload['reason_detail'] ?? null,
        ]);

        return response()->json([
            'data' => [
                'updated_count' => $updatedCount,
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

    public function updateManifest(Request $request, string $id): JsonResponse
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
            'manifest_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $notes = $payload['manifest_notes'] ?? null;
        if (is_string($notes) && trim($notes) === '') {
            $notes = null;
        }

        DB::table('routes')
            ->where('id', $id)
            ->update([
                'manifest_notes' => $notes,
                'updated_at' => now(),
            ]);

        $this->writeRouteAudit($actor, $id, 'route.manifest.updated', [
            'manifest_notes' => $notes,
        ]);

        return response()->json([
            'data' => [
                'route_id' => $id,
                'manifest_notes' => $notes,
            ],
        ]);
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
        $rows[] = 'route_code,route_date,status,driver_code,vehicle_code,sequence,stop_type,reference,expedition_reference,linked_reference,operation_kind,product_category,service_type,counterparty_name,address_line,stop_status';
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
                $this->csvValue((string) ($stop->expedition_reference ?? '')),
                $this->csvValue((string) ($stop->linked_reference ?? '')),
                $this->csvValue((string) ($stop->operation_kind ?? '')),
                $this->csvValue((string) ($stop->product_category ?? '')),
                $this->csvValue((string) ($stop->service_type ?? '')),
                $this->csvValue((string) ($stop->counterparty_name ?? '')),
                $this->csvValue((string) ($stop->address_line ?? '')),
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

        $this->writeRouteAudit($actor, $id, 'route.manifest.exported.pdf', [
            'rows_count' => count($payload['stops']),
        ]);

        return response($this->buildRouteManifestPdf($payload), 200, [
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
                $this->throwValidationError('Delivery stop requires shipment_id and must not include pickup_id.', 'shipment_id');
            }
            return;
        }

        if (empty($payload['pickup_id']) || !empty($payload['shipment_id'])) {
            $this->throwValidationError('Pickup stop requires pickup_id and must not include shipment_id.', 'pickup_id');
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
            $this->throwValidationError('Sequence already exists for this route.', 'sequence');
        }
    }

    private function assertStopNotDuplicatedInRoute(object $route, array $payload): void
    {
        if (!empty($payload['shipment_id'])) {
            $exists = DB::table('route_stops')
                ->where('route_id', $route->id)
                ->where('shipment_id', $payload['shipment_id'])
                ->exists();
            if ($exists) {
                $this->throwValidationError('Shipment is already assigned to this route.', 'shipment_id');
            }
        }
        if (!empty($payload['pickup_id'])) {
            $exists = DB::table('route_stops')
                ->where('route_id', $route->id)
                ->where('pickup_id', $payload['pickup_id'])
                ->exists();
            if ($exists) {
                $this->throwValidationError('Pickup is already assigned to this route.', 'pickup_id');
            }
        }
    }

    private function assertStopTemporalWindowConsistency(object $route, array $payload): void
    {
        if (!empty($payload['shipment_id'])) {
            $shipment = DB::table('shipments')
                ->where('id', $payload['shipment_id'])
                ->first(['scheduled_at', 'service_type']);
            if (
                $shipment &&
                $shipment->scheduled_at &&
                !$this->isWithinAllowedWindow(
                    (string) $route->route_date,
                    (string) $shipment->scheduled_at,
                    $shipment->service_type ? (string) $shipment->service_type : null
                )
            ) {
                $this->throwValidationError('Shipment time window is outside the allowed service window.', 'shipment_id');
            }
        }

        if (!empty($payload['pickup_id'])) {
            $scheduledAt = DB::table('pickups')->where('id', $payload['pickup_id'])->value('scheduled_at');
            if ($scheduledAt && !$this->isWithinTwoDays((string) $route->route_date, (string) $scheduledAt)) {
                $this->throwValidationError('Pickup time window is outside the allowed route window (+/- 2 days).', 'pickup_id');
            }
        }
    }

    private function assertBulkStopTemporalWindowConsistency(object $route, array $shipmentIds, array $pickupIds): void
    {
        foreach ($shipmentIds as $shipmentId) {
            $shipment = DB::table('shipments')->where('id', $shipmentId)->first(['scheduled_at', 'service_type']);
            if (
                $shipment &&
                $shipment->scheduled_at &&
                !$this->isWithinAllowedWindow(
                    (string) $route->route_date,
                    (string) $shipment->scheduled_at,
                    $shipment->service_type ? (string) $shipment->service_type : null
                )
            ) {
                $this->throwValidationError('At least one shipment is outside the allowed service window.', 'shipment_ids');
            }
        }
        foreach ($pickupIds as $pickupId) {
            $scheduledAt = DB::table('pickups')->where('id', $pickupId)->value('scheduled_at');
            if ($scheduledAt && !$this->isWithinTwoDays((string) $route->route_date, (string) $scheduledAt)) {
                $this->throwValidationError('At least one pickup is outside the allowed route window (+/- 2 days).', 'pickup_ids');
            }
        }
    }

    private function assertRouteVehicleCapacityForStop(object $route, array $payload): void
    {
        if (empty($route->vehicle_id) || empty($payload['shipment_id'])) {
            return;
        }
        $this->assertRouteVehicleCapacityForBulkStops($route, [(string) $payload['shipment_id']]);
    }

    private function assertRouteVehicleCapacityForBulkStops(object $route, array $shipmentIds): void
    {
        if (empty($route->vehicle_id) || $shipmentIds === []) {
            return;
        }

        $capacityKg = DB::table('vehicles')->where('id', $route->vehicle_id)->value('capacity_kg');
        if (!$capacityKg) {
            return;
        }

        $assignedShipmentIds = DB::table('route_stops')
            ->where('route_id', $route->id)
            ->whereNotNull('shipment_id')
            ->pluck('shipment_id')
            ->all();

        $currentWeightGrams = 0;
        if ($assignedShipmentIds !== []) {
            $currentWeightGrams = (int) DB::table('parcels')
                ->whereIn('shipment_id', $assignedShipmentIds)
                ->sum('weight_grams');
        }

        $newWeightGrams = (int) DB::table('parcels')
            ->whereIn('shipment_id', $shipmentIds)
            ->sum('weight_grams');

        $totalKg = ($currentWeightGrams + $newWeightGrams) / 1000;
        if ($totalKg > ((float) $capacityKg + 0.0001)) {
            $this->throwValidationError('Route vehicle capacity exceeded by stop assignment.', 'shipment_ids');
        }
    }

    private function isWithinTwoDays(string $routeDate, string $scheduledAt): bool
    {
        $routeTs = strtotime(substr($routeDate, 0, 10));
        $scheduledTs = strtotime(substr($scheduledAt, 0, 10));
        if ($routeTs === false || $scheduledTs === false) {
            return true;
        }
        $diffDays = abs((int) floor(($routeTs - $scheduledTs) / 86400));
        return $diffDays <= 2;
    }

    private function isWithinAllowedWindow(string $routeDate, string $scheduledAt, ?string $serviceType): bool
    {
        $allowedDays = $this->allowedDaysByServiceType($serviceType);
        $routeTs = strtotime(substr($routeDate, 0, 10));
        $scheduledTs = strtotime(substr($scheduledAt, 0, 10));
        if ($routeTs === false || $scheduledTs === false) {
            return true;
        }
        $diffDays = abs((int) floor(($routeTs - $scheduledTs) / 86400));
        return $diffDays <= $allowedDays;
    }

    private function allowedDaysByServiceType(?string $serviceType): int
    {
        return match ($serviceType) {
            'express_1030', 'express_1400', 'express_1900' => 0,
            default => 2,
        };
    }

    private function shiftDateTime(?string $value, int $shiftMinutes): ?string
    {
        if ($value === null || trim($value) === '' || $shiftMinutes === 0) {
            return $value;
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return $value;
        }

        return date('Y-m-d H:i:s', $timestamp + ($shiftMinutes * 60));
    }

    /**
     * @param array<int,array{field:string,message:string,code?:string}> $warnings
     */
    private function assertPublishAllowedByPolicy(User $actor, array $warnings): void
    {
        $policy = $this->resolvePublishPolicy();
        if (!$policy['enforce_on_publish']) {
            return;
        }

        $bypassRoles = $policy['bypass_role_codes'];
        foreach ($bypassRoles as $roleCode) {
            if (is_string($roleCode) && $roleCode !== '' && $actor->hasRole($roleCode)) {
                return;
            }
        }

        $criticalCodes = array_values(array_filter($policy['critical_warning_codes'], fn ($value) => is_string($value) && $value !== ''));
        if ($criticalCodes === []) {
            return;
        }

        foreach ($warnings as $warning) {
            $code = $warning['code'] ?? null;
            if (is_string($code) && in_array($code, $criticalCodes, true)) {
                $this->throwValidationError('Route publish blocked by critical warning policy: ' . $warning['message'], $warning['field']);
            }
        }
    }

    /**
     * @return array{enforce_on_publish:bool,critical_warning_codes:array<int,string>,bypass_role_codes:array<int,string>}
     */
    private function resolvePublishPolicy(): array
    {
        $row = DB::table('route_assignment_policies')->where('id', 1)->first();
        if (!$row) {
            return [
                'enforce_on_publish' => true,
                'critical_warning_codes' => ['LOW_DRIVER_QUALITY', 'LOW_SUBCONTRACTOR_QUALITY'],
                'bypass_role_codes' => ['super_admin'],
            ];
        }

        $criticalWarningCodes = json_decode((string) $row->critical_warning_codes, true);
        $bypassRoleCodes = json_decode((string) $row->bypass_role_codes, true);

        return [
            'enforce_on_publish' => (bool) $row->enforce_on_publish,
            'critical_warning_codes' => is_array($criticalWarningCodes) ? array_values(array_map('strval', $criticalWarningCodes)) : [],
            'bypass_role_codes' => is_array($bypassRoleCodes) ? array_values(array_map('strval', $bypassRoleCodes)) : [],
        ];
    }

    private function throwValidationError(string $message, string $field): void
    {
        $errors = [
            $field => [$message],
        ];
        throw new HttpResponseException(response()->json([
            'error' => [
                'code' => 'VALIDATION_ERROR',
                'message' => $message,
                'details' => $errors,
            ],
            'message' => $message,
            'errors' => $errors,
        ], 422));
    }

    private function fetchStopById(string $stopId): ?object
    {
        return DB::table('route_stops')
            ->leftJoin('shipments', 'shipments.id', '=', 'route_stops.shipment_id')
            ->leftJoin('pickups', 'pickups.id', '=', 'route_stops.pickup_id')
            ->leftJoin('expeditions', function ($join): void {
                $join->on('expeditions.id', '=', 'shipments.expedition_id')
                    ->orOn('expeditions.id', '=', 'pickups.expedition_id');
            })
            ->leftJoin('shipments as linked_shipments', 'linked_shipments.id', '=', 'expeditions.shipment_id')
            ->leftJoin('pickups as linked_pickups', 'linked_pickups.id', '=', 'expeditions.pickup_id')
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
                'expeditions.id as expedition_id',
                'expeditions.reference as expedition_reference',
                'expeditions.operation_kind',
                'expeditions.product_category',
                DB::raw('COALESCE(shipments.service_type, pickups.service_type) as service_type'),
                DB::raw('COALESCE(shipments.consignee_name, pickups.requester_name) as counterparty_name'),
                DB::raw('COALESCE(shipments.address_line, pickups.address_line) as address_line'),
                DB::raw("CASE WHEN route_stops.shipment_id IS NOT NULL THEN linked_pickups.reference ELSE linked_shipments.reference END as linked_reference"),
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
            ->leftJoin('expeditions', function ($join): void {
                $join->on('expeditions.id', '=', 'shipments.expedition_id')
                    ->orOn('expeditions.id', '=', 'pickups.expedition_id');
            })
            ->leftJoin('shipments as linked_shipments', 'linked_shipments.id', '=', 'expeditions.shipment_id')
            ->leftJoin('pickups as linked_pickups', 'linked_pickups.id', '=', 'expeditions.pickup_id')
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
                'expeditions.id as expedition_id',
                'expeditions.reference as expedition_reference',
                'expeditions.operation_kind',
                'expeditions.product_category',
                DB::raw('COALESCE(shipments.service_type, pickups.service_type) as service_type'),
                DB::raw('COALESCE(shipments.consignee_name, pickups.requester_name) as counterparty_name'),
                DB::raw('COALESCE(shipments.address_line, pickups.address_line) as address_line'),
                DB::raw("CASE WHEN route_stops.shipment_id IS NOT NULL THEN linked_pickups.reference ELSE linked_shipments.reference END as linked_reference"),
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
                'routes.manifest_notes',
                'drivers.code as driver_code',
                'vehicles.plate_number as vehicle_code'
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
     * @param array<string, mixed> $payload
     */
    private function buildRouteManifestPdf(array $payload): string
    {
        $pageWidth = 842;
        $pageHeight = 595;
        $left = 28;
        $right = 814;
        $logoPath = public_path('logo-print-header.jpg');
        $logoData = is_file($logoPath) ? file_get_contents($logoPath) : false;
        $pages = [];
        $commands = [];

        $drawText = function (float $x, float $y, int $size, string $text, string $rgb = '0.10 0.14 0.20'): string {
            return sprintf('%s rg BT /F1 %d Tf %.2F %.2F Td (%s) Tj ET', $rgb, $size, $x, $y, $this->pdfEscape($text));
        };
        $drawFill = static function (float $x, float $y, float $w, float $h, string $rgb): string {
            return sprintf('%s rg %.2F %.2F %.2F %.2F re f', $rgb, $x, $y, $w, $h);
        };
        $drawStroke = static function (float $x, float $y, float $w, float $h, string $rgb = '0.85 0.89 0.94'): string {
            return sprintf('%s RG %.2F %.2F %.2F %.2F re S', $rgb, $x, $y, $w, $h);
        };

        $route = $payload['route'];
        $summaryBoxes = [
            ['Ruta', (string) $route->code],
            ['Fecha', (string) $route->route_date],
            ['Estado', (string) $route->status],
            ['Conductor', (string) ($route->driver_code ?? '-')],
            ['Vehículo', (string) ($route->vehicle_code ?? '-')],
            ['Paradas', (string) $payload['totals']['stops']],
            ['Recogidas', (string) $payload['totals']['pickups']],
            ['Entregas', (string) $payload['totals']['deliveries']],
            ['Completadas', (string) $payload['totals']['completed']],
        ];

        $notes = trim((string) ($route->manifest_notes ?? ''));
        $notesText = $notes !== '' ? $notes : 'Sin notas operativas.';
        $statusLegend = [
            ['Planificada', '0.10 0.14 0.20'],
            ['En curso', '0.13 0.23 0.54'],
            ['Completada', '0.10 0.45 0.24'],
            ['Incidencia', '0.72 0.39 0.05'],
        ];
        $columns = [
            ['x' => 28, 'label' => 'Sec.'],
            ['x' => 58, 'label' => 'Pata'],
            ['x' => 112, 'label' => 'Referencia'],
            ['x' => 196, 'label' => 'Vinculada'],
            ['x' => 280, 'label' => 'Operación'],
            ['x' => 344, 'label' => 'Producto'],
            ['x' => 402, 'label' => 'Servicio'],
            ['x' => 480, 'label' => 'Contraparte'],
            ['x' => 612, 'label' => 'Dirección'],
            ['x' => 756, 'label' => 'Estado'],
        ];

        $appendPageHeader = function (array &$pageCommands, int $pageNumber) use (
            $drawFill,
            $drawStroke,
            $drawText,
            $logoData,
            $left,
            $right,
            $pageWidth,
            $pageHeight,
            $route,
            $summaryBoxes,
            $notesText,
            $statusLegend,
            $columns
        ): float {
            $pageCommands[] = $drawFill(0, 0, $pageWidth, $pageHeight, '1 1 1');
            $pageCommands[] = $drawFill(0, 535, $pageWidth, 60, '0.06 0.11 0.18');
            if ($logoData !== false) {
                $pageCommands[] = 'q 26 0 0 26 28 548 cm /Im1 Do Q';
            }
            $pageCommands[] = $drawText(62, 564, 22, 'Eco Delivery Routes', '1 1 1');
            $pageCommands[] = $drawText(62, 545, 11, 'Manifiesto de ruta operativo', '0.86 0.90 0.95');
            $pageCommands[] = $drawText(648, 560, 10, 'Generado: ' . now()->format('d/m/Y H:i'), '0.86 0.90 0.95');
            $pageCommands[] = $drawText(744, 545, 9, 'Página ' . $pageNumber, '0.86 0.90 0.95');

            $boxWidth = 82;
            $boxHeight = 42;
            $boxGap = 6;
            $boxX = $left;
            $boxY = 480;
            foreach ($summaryBoxes as [$label, $value]) {
                $pageCommands[] = $drawFill($boxX, $boxY, $boxWidth, $boxHeight, '0.97 0.98 0.99');
                $pageCommands[] = $drawStroke($boxX, $boxY, $boxWidth, $boxHeight);
                $pageCommands[] = $drawText($boxX + 8, $boxY + 26, 8, $label);
                $pageCommands[] = $drawText($boxX + 8, $boxY + 10, 12, $value);
                $boxX += $boxWidth + $boxGap;
            }

            $pageCommands[] = $drawFill($left, 430, $right - $left, 38, '0.99 0.99 1');
            $pageCommands[] = $drawStroke($left, 430, $right - $left, 38);
            $pageCommands[] = $drawText($left + 8, 452, 8, 'Notas operativas');
            $pageCommands[] = $drawText($left + 8, 438, 10, mb_substr($notesText, 0, 120));

            $legendY = 408;
            $pageCommands[] = $drawText($left + 8, $legendY + 7, 8, 'Leyenda de estados');
            $legendX = $left + 106;
            foreach ($statusLegend as [$label, $color]) {
                $pageCommands[] = $drawFill($legendX, $legendY + 2, 10, 10, $color);
                $pageCommands[] = $drawStroke($legendX, $legendY + 2, 10, 10, '0.85 0.89 0.94');
                $pageCommands[] = $drawText($legendX + 16, $legendY + 4, 8, $label);
                $legendX += 110;
            }

            $headerY = 384;
            $pageCommands[] = $drawFill($left, $headerY, $right - $left, 18, '0.10 0.16 0.24');
            foreach ($columns as $column) {
                $pageCommands[] = $drawText($column['x'] + 4, $headerY + 5, 8, $column['label'], '1 1 1');
            }

            return 376.0;
        };

        $currentPage = 1;
        $cursorY = $appendPageHeader($commands, $currentPage);
        $groupedStops = collect($payload['stops'])->groupBy(fn ($stop) => (string) ($stop->expedition_reference ?? 'SIN-EXPEDICION'));
        foreach ($groupedStops as $expeditionReference => $groupStops) {
            /** @var object $first */
            $first = $groupStops->first();
            $groupHeight = 18 + (count($groupStops) * 18) + 8;
            if ($cursorY - $groupHeight < 48) {
                $commands[] = $drawText($left, 22, 8, 'Documento operativo para tráfico y almacén · Eco Delivery Routes');
                $pages[] = implode("\n", $commands) . "\n";
                $commands = [];
                $currentPage++;
                $cursorY = $appendPageHeader($commands, $currentPage);
            }

            $cursorY -= (18 + (count($groupStops) * 18));
            $commands[] = $drawFill($left, $cursorY + (count($groupStops) * 18), $right - $left, 18, '0.92 0.95 0.98');
            $commands[] = $drawStroke($left, $cursorY, $right - $left, 18 + (count($groupStops) * 18));
            $commands[] = $drawText($left + 8, $cursorY + (count($groupStops) * 18) + 5, 10, sprintf(
                'EXPEDICIÓN %s · %s · %s · %s · HUB %s',
                $expeditionReference,
                (string) ($first->operation_kind ?? '-'),
                (string) ($first->product_category ?? '-'),
                (string) ($first->service_type ?? '-'),
                (string) ($route->hub_code ?? '-')
            ));

            $rowY = $cursorY + (count($groupStops) * 18) - 11;
            foreach ($groupStops as $stop) {
                $statusColor = match ((string) $stop->status) {
                    'completed', 'delivered' => '0.10 0.45 0.24',
                    'in_progress', 'out_for_delivery' => '0.13 0.23 0.54',
                    'incident' => '0.72 0.39 0.05',
                    default => '0.10 0.14 0.20',
                };
                $commands[] = $drawText(32, $rowY, 8, (string) $stop->sequence);
                $commands[] = $drawText(62, $rowY, 8, $stop->stop_type === 'PICKUP' ? 'RECOGIDA' : 'ENTREGA');
                $commands[] = $drawText(116, $rowY, 8, mb_substr((string) ($stop->reference ?? $stop->entity_id), 0, 16));
                $commands[] = $drawText(200, $rowY, 8, mb_substr((string) ($stop->linked_reference ?? '-'), 0, 16));
                $commands[] = $drawText(284, $rowY, 8, mb_substr(mb_strtoupper((string) ($stop->operation_kind ?? '-')), 0, 11));
                $commands[] = $drawText(348, $rowY, 8, mb_substr((string) ($stop->product_category ?? '-'), 0, 10));
                $commands[] = $drawText(406, $rowY, 8, mb_substr((string) ($stop->service_type ?? '-'), 0, 13));
                $commands[] = $drawText(484, $rowY, 7, mb_substr((string) ($stop->counterparty_name ?? '-'), 0, 27));
                $commands[] = $drawText(616, $rowY, 7, mb_substr((string) ($stop->address_line ?? '-'), 0, 30));
                $commands[] = $drawText(760, $rowY, 8, mb_substr((string) $stop->status, 0, 10), $statusColor);
                $rowY -= 18;
            }
            $cursorY -= 8;
        }
        $commands[] = $drawText($left, 22, 8, 'Documento operativo para tráfico y almacén · Eco Delivery Routes');
        $pages[] = implode("\n", $commands) . "\n";

        $objects = [];
        $objects[] = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';

        $pageCount = count($pages);
        $pageObjectStart = 3;
        $contentObjectStart = $pageObjectStart + $pageCount;
        $fontObjectNum = $contentObjectStart + $pageCount;
        $imageObjectNum = $fontObjectNum + 1;
        $kids = [];
        for ($index = 0; $index < $pageCount; $index++) {
            $kids[] = ($pageObjectStart + $index) . ' 0 R';
        }
        $objects[] = '2 0 obj << /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $pageCount . ' >> endobj';

        for ($index = 0; $index < $pageCount; $index++) {
            $pageObjectNum = $pageObjectStart + $index;
            $contentObjectNum = $contentObjectStart + $index;
            $resources = '<< /Font << /F1 ' . $fontObjectNum . ' 0 R >>';
            if ($logoData !== false) {
                $resources .= ' /XObject << /Im1 ' . $imageObjectNum . ' 0 R >>';
            }
            $resources .= ' >>';
            $objects[] = sprintf(
                '%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents %d 0 R /Resources %s >> endobj',
                $pageObjectNum,
                $contentObjectNum,
                $resources
            );
        }

        foreach ($pages as $content) {
            $length = strlen($content);
            $objects[] = "0 0 obj << /Length {$length} >> stream\n{$content}endstream endobj";
        }
        for ($index = 0; $index < $pageCount; $index++) {
            $contentIndex = 2 + $pageCount + $index;
            $objects[$contentIndex] = str_replace('0 0 obj', ($contentObjectStart + $index) . ' 0 obj', $objects[$contentIndex]);
        }

        $objects[] = $fontObjectNum . ' 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj';
        if ($logoData !== false) {
            $objects[] = $imageObjectNum . ' 0 obj << /Type /XObject /Subtype /Image /Width 980 /Height 1024 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($logoData) . " >> stream\n" . $logoData . "\nendstream endobj";
        }

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
        $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }

    private function pdfEscape(string $value): string
    {
        $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value);
        if ($encoded === false) {
            $encoded = $value;
        }
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $encoded);
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
        $objects[] = '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj';

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
