<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DriverRouteController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $driver = DB::table('drivers')->where('user_id', $actor->id)->first();
        if (!$driver) {
            return response()->json(['data' => ['route' => null, 'stops' => []]]);
        }

        $routeDate = $request->query('route_date');
        $status = $request->query('status');
        $routeQuery = DB::table('routes')->where('driver_id', $driver->id);

        if (is_string($routeDate) && $routeDate !== '') {
            $routeQuery->whereDate('route_date', $routeDate);
        }
        if (is_string($status) && $status !== '') {
            $routeQuery->where('status', $status);
        }

        $route = $routeQuery
            ->orderByDesc('route_date')
            ->orderByDesc('created_at')
            ->first();

        if (!$route) {
            return response()->json(['data' => ['route' => null, 'stops' => []]]);
        }

        $stops = DB::table('route_stops')
            ->leftJoin('shipments', 'shipments.id', '=', 'route_stops.shipment_id')
            ->leftJoin('pickups', 'pickups.id', '=', 'route_stops.pickup_id')
            ->where('route_stops.route_id', $route->id)
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
            ]);

        return response()->json([
            'data' => [
                'driver' => [
                    'id' => $driver->id,
                    'code' => $driver->code,
                    'name' => $driver->name,
                ],
                'route' => $route,
                'stops' => $stops,
            ],
        ]);
    }
}
