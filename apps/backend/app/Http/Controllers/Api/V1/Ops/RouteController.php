<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->select('routes.*', DB::raw('count(route_stops.id) as stops_count'))
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
            'hub_id' => ['required', 'uuid'],
            'code' => ['required', 'string', 'max:60'],
            'route_date' => ['required', 'date'],
            'driver_id' => ['nullable', 'uuid'],
            'subcontractor_id' => ['nullable', 'uuid'],
        ]);

        $id = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'code' => $payload['code'],
            'route_date' => $payload['route_date'],
            'driver_id' => $payload['driver_id'] ?? null,
            'subcontractor_id' => $payload['subcontractor_id'] ?? null,
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('routes')->where('id', $id)->first()], 201);
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
            'data' => DB::table('route_stops')
                ->leftJoin('shipments', 'shipments.id', '=', 'route_stops.shipment_id')
                ->leftJoin('pickups', 'pickups.id', '=', 'route_stops.pickup_id')
                ->where('route_stops.route_id', $id)
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
                ]),
        ]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}
