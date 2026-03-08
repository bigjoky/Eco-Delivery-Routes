<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadDashboard($actor)) {
            return $this->forbidden();
        }

        $periodPreset = (string) $request->query('period', '7d');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        [$from, $to, $preset] = $this->resolvePeriod(
            is_string($dateFrom) ? $dateFrom : null,
            is_string($dateTo) ? $dateTo : null,
            $periodPreset
        );

        $threshold = (float) (DB::table('quality_threshold_settings')
            ->where('scope_type', 'global')
            ->orderByDesc('updated_at')
            ->value('threshold') ?? 95);

        $shipmentsWindow = DB::table('shipments')
            ->where(function ($query) use ($from, $to): void {
                $query->whereBetween(DB::raw('DATE(COALESCE(scheduled_at, created_at))'), [$from, $to]);
            });
        $routesWindow = DB::table('routes')
            ->whereBetween('route_date', [$from, $to]);
        $incidentsWindow = DB::table('incidents')
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to]);

        $shipmentsByStatus = [
            'created' => (clone $shipmentsWindow)->where('status', 'created')->count(),
            'out_for_delivery' => (clone $shipmentsWindow)->where('status', 'out_for_delivery')->count(),
            'delivered' => (clone $shipmentsWindow)->where('status', 'delivered')->count(),
            'incident' => (clone $shipmentsWindow)->where('status', 'incident')->count(),
        ];
        $routesByStatus = [
            'planned' => (clone $routesWindow)->where('status', 'planned')->count(),
            'in_progress' => (clone $routesWindow)->where('status', 'in_progress')->count(),
            'completed' => (clone $routesWindow)->where('status', 'completed')->count(),
        ];

        $routeQualityRows = DB::table('quality_snapshots')
            ->where('scope_type', 'route')
            ->whereBetween('period_end', [$from, $to])
            ->select('scope_id', DB::raw('MAX(service_quality_score) as service_quality_score'))
            ->groupBy('scope_id')
            ->get();

        $driverQualityRows = DB::table('quality_snapshots')
            ->where('scope_type', 'driver')
            ->whereBetween('period_end', [$from, $to])
            ->select('scope_id', DB::raw('MAX(service_quality_score) as service_quality_score'))
            ->groupBy('scope_id')
            ->get();

        $routeAvg = $routeQualityRows->count() > 0
            ? round((float) $routeQualityRows->avg('service_quality_score'), 2)
            : 0.0;
        $driverAvg = $driverQualityRows->count() > 0
            ? round((float) $driverQualityRows->avg('service_quality_score'), 2)
            : 0.0;
        $belowThresholdRoutes = $routeQualityRows->filter(fn ($row) => (float) $row->service_quality_score < $threshold)->count();

        $recentRoutes = DB::table('routes')
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->select(
                'routes.id',
                'routes.code',
                'routes.route_date',
                'routes.status',
                DB::raw('COUNT(route_stops.id) as stops_count')
            )
            ->whereBetween('routes.route_date', [$from, $to])
            ->groupBy('routes.id', 'routes.code', 'routes.route_date', 'routes.status')
            ->orderBy('routes.route_date')
            ->limit(5)
            ->get();

        $recentShipments = DB::table('shipments')
            ->select('id', 'reference', 'external_reference', 'status', 'consignee_name', 'service_type')
            ->whereBetween(DB::raw('DATE(COALESCE(scheduled_at, created_at))'), [$from, $to])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        $recentIncidents = DB::table('incidents')
            ->select('id', 'incidentable_type', 'incidentable_id', 'catalog_code', 'category', 'priority', 'sla_status', 'notes', 'resolved_at')
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to])
            ->whereNull('resolved_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        $productivityByHub = DB::table('routes')
            ->join('hubs', 'hubs.id', '=', 'routes.hub_id')
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->whereBetween('routes.route_date', [$from, $to])
            ->groupBy('hubs.id', 'hubs.code', 'hubs.name')
            ->select(
                'hubs.id as hub_id',
                'hubs.code as hub_code',
                'hubs.name as hub_name',
                DB::raw('COUNT(DISTINCT routes.id) as routes_total'),
                DB::raw("COUNT(DISTINCT CASE WHEN routes.status = 'completed' THEN routes.id END) as routes_completed"),
                DB::raw('COUNT(route_stops.id) as planned_stops'),
                DB::raw("SUM(CASE WHEN route_stops.status = 'completed' THEN 1 ELSE 0 END) as completed_stops")
            )
            ->orderBy('hubs.code')
            ->get()
            ->map(function ($row) {
                $plannedStops = (int) ($row->planned_stops ?? 0);
                $completedStops = (int) ($row->completed_stops ?? 0);
                $ratio = $plannedStops > 0 ? round(($completedStops / $plannedStops) * 100, 2) : 0.0;
                return [
                    'hub_id' => $row->hub_id,
                    'hub_code' => $row->hub_code,
                    'hub_name' => $row->hub_name,
                    'routes_total' => (int) $row->routes_total,
                    'routes_completed' => (int) $row->routes_completed,
                    'planned_stops' => $plannedStops,
                    'completed_stops' => $completedStops,
                    'completion_ratio' => $ratio,
                ];
            })
            ->values();

        $productivityByRoute = DB::table('routes')
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->whereBetween('routes.route_date', [$from, $to])
            ->groupBy('routes.id', 'routes.code', 'routes.route_date', 'routes.status')
            ->select(
                'routes.id as route_id',
                'routes.code as route_code',
                'routes.route_date',
                'routes.status',
                DB::raw('COUNT(route_stops.id) as planned_stops'),
                DB::raw("SUM(CASE WHEN route_stops.status = 'completed' THEN 1 ELSE 0 END) as completed_stops")
            )
            ->orderBy('routes.route_date')
            ->limit(10)
            ->get()
            ->map(function ($row) {
                $plannedStops = (int) ($row->planned_stops ?? 0);
                $completedStops = (int) ($row->completed_stops ?? 0);
                $ratio = $plannedStops > 0 ? round(($completedStops / $plannedStops) * 100, 2) : 0.0;
                return [
                    'route_id' => $row->route_id,
                    'route_code' => $row->route_code,
                    'route_date' => (string) $row->route_date,
                    'status' => (string) $row->status,
                    'planned_stops' => $plannedStops,
                    'completed_stops' => $completedStops,
                    'completion_ratio' => $ratio,
                ];
            })
            ->values();

        $incidentsOpenCount = DB::table('incidents')->whereNull('resolved_at')->count();
        $shipmentsIncidentCount = (clone $shipmentsWindow)->where('status', 'incident')->count();
        $plannedWithoutDriver = DB::table('routes')
            ->whereBetween('route_date', [$from, $to])
            ->where('status', 'planned')
            ->whereNull('driver_id')
            ->count();

        $alerts = collect([
            [
                'id' => 'incidents-open',
                'severity' => 'high',
                'title' => 'Incidencias abiertas',
                'message' => 'Hay incidencias pendientes de resolución.',
                'href' => '/incidents?resolved=open',
                'count' => $incidentsOpenCount,
            ],
            [
                'id' => 'quality-below-threshold',
                'severity' => 'medium',
                'title' => 'Rutas bajo umbral de calidad',
                'message' => 'Revisar rutas por debajo del KPI objetivo.',
                'href' => '/quality?scopeType=route',
                'count' => $belowThresholdRoutes,
            ],
            [
                'id' => 'shipments-with-incident',
                'severity' => 'medium',
                'title' => 'Envíos en incidencia',
                'message' => 'Envíos con estado incident en el periodo seleccionado.',
                'href' => '/shipments?status=incident',
                'count' => $shipmentsIncidentCount,
            ],
            [
                'id' => 'planned-routes-without-driver',
                'severity' => 'low',
                'title' => 'Rutas planned sin conductor',
                'message' => 'Completar asignación de conductor antes de publicar.',
                'href' => '/routes?status=planned',
                'count' => $plannedWithoutDriver,
            ],
        ])->filter(fn ($alert) => (int) $alert['count'] > 0)->values();

        return response()->json([
            'data' => [
                'period' => [
                    'from' => $from,
                    'to' => $to,
                    'preset' => $preset,
                ],
                'totals' => [
                    'shipments' => (clone $shipmentsWindow)->count(),
                    'routes' => (clone $routesWindow)->count(),
                    'incidents_open' => $incidentsOpenCount,
                    'quality_threshold' => $threshold,
                ],
                'shipments_by_status' => $shipmentsByStatus,
                'routes_by_status' => $routesByStatus,
                'quality' => [
                    'route_avg' => $routeAvg,
                    'driver_avg' => $driverAvg,
                    'below_threshold_routes' => $belowThresholdRoutes,
                ],
                'recent' => [
                    'routes' => $recentRoutes,
                    'shipments' => $recentShipments,
                    'incidents' => $recentIncidents,
                ],
                'productivity_by_hub' => $productivityByHub,
                'productivity_by_route' => $productivityByRoute,
                'alerts' => $alerts,
            ],
        ]);
    }

    private function resolvePeriod(?string $dateFrom, ?string $dateTo, string $preset): array
    {
        if ($dateFrom !== null && $dateTo !== null) {
            return [$dateFrom, $dateTo, 'custom'];
        }

        $to = Carbon::today();
        $normalizedPreset = in_array($preset, ['today', '7d', '30d'], true) ? $preset : '7d';
        $from = (clone $to);
        if ($normalizedPreset === '7d') {
            $from->subDays(6);
        }
        if ($normalizedPreset === '30d') {
            $from->subDays(29);
        }

        return [$from->toDateString(), $to->toDateString(), $normalizedPreset];
    }

    private function canReadDashboard(User $actor): bool
    {
        return $actor->hasPermission('shipments.read')
            || $actor->hasPermission('routes.read')
            || $actor->hasPermission('incidents.read')
            || $actor->hasPermission('quality.read')
            || $actor->hasPermission('quality.read.dashboard');
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}
