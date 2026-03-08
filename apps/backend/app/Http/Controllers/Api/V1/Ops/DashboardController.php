<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
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
        $hubId = $request->query('hub_id');
        $subcontractorId = $request->query('subcontractor_id');
        [$from, $to, $preset] = $this->resolvePeriod(
            is_string($dateFrom) ? $dateFrom : null,
            is_string($dateTo) ? $dateTo : null,
            $periodPreset
        );

        $cacheKey = sprintf(
            'dashboard_overview:%s:%s:%s:%s:%s:%s',
            $actor->id,
            $from,
            $to,
            $preset,
            is_string($hubId) ? $hubId : '',
            is_string($subcontractorId) ? $subcontractorId : ''
        );
        $payload = Cache::remember($cacheKey, now()->addSeconds(60), function () use ($from, $to, $preset, $hubId, $subcontractorId): array {
            return $this->buildPayload(
                from: $from,
                to: $to,
                preset: $preset,
                hubId: is_string($hubId) && $hubId !== '' ? $hubId : null,
                subcontractorId: is_string($subcontractorId) && $subcontractorId !== '' ? $subcontractorId : null
            );
        });

        return response()->json(['data' => $payload]);
    }

    public function exportCsv(Request $request)
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadDashboard($actor)) {
            return $this->forbidden();
        }

        $periodPreset = (string) $request->query('period', '7d');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $hubId = $request->query('hub_id');
        $subcontractorId = $request->query('subcontractor_id');
        [$from, $to, $preset] = $this->resolvePeriod(
            is_string($dateFrom) ? $dateFrom : null,
            is_string($dateTo) ? $dateTo : null,
            $periodPreset
        );

        $payload = $this->buildPayload(
            from: $from,
            to: $to,
            preset: $preset,
            hubId: is_string($hubId) && $hubId !== '' ? $hubId : null,
            subcontractorId: is_string($subcontractorId) && $subcontractorId !== '' ? $subcontractorId : null
        );

        $filename = sprintf('dashboard_overview_%s_%s.csv', $from, $to);
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        return response()->stream(function () use ($payload): void {
            $stream = fopen('php://output', 'w');
            if ($stream === false) {
                return;
            }

            fputcsv($stream, ['section', 'metric', 'value']);
            fputcsv($stream, ['period', 'from', $payload['period']['from'] ?? '']);
            fputcsv($stream, ['period', 'to', $payload['period']['to'] ?? '']);
            fputcsv($stream, ['period', 'preset', $payload['period']['preset'] ?? '']);
            fputcsv($stream, ['filters', 'hub_id', $payload['filters']['hub_id'] ?? '']);
            fputcsv($stream, ['filters', 'subcontractor_id', $payload['filters']['subcontractor_id'] ?? '']);

            foreach (($payload['totals'] ?? []) as $metric => $value) {
                fputcsv($stream, ['totals', (string) $metric, is_scalar($value) ? (string) $value : json_encode($value)]);
            }
            foreach (($payload['sla'] ?? []) as $metric => $value) {
                fputcsv($stream, ['sla', (string) $metric, is_scalar($value) ? (string) $value : json_encode($value)]);
            }
            foreach (($payload['shipments_by_status'] ?? []) as $metric => $value) {
                fputcsv($stream, ['shipments_by_status', (string) $metric, is_scalar($value) ? (string) $value : json_encode($value)]);
            }
            foreach (($payload['routes_by_status'] ?? []) as $metric => $value) {
                fputcsv($stream, ['routes_by_status', (string) $metric, is_scalar($value) ? (string) $value : json_encode($value)]);
            }
            foreach (($payload['quality'] ?? []) as $metric => $value) {
                fputcsv($stream, ['quality', (string) $metric, is_scalar($value) ? (string) $value : json_encode($value)]);
            }

            foreach (($payload['trends']['shipments'] ?? []) as $index => $row) {
                fputcsv($stream, ['trends.shipments', (string) $index, json_encode($row)]);
            }
            foreach (($payload['trends']['routes'] ?? []) as $index => $row) {
                fputcsv($stream, ['trends.routes', (string) $index, json_encode($row)]);
            }
            foreach (($payload['trends']['incidents'] ?? []) as $index => $row) {
                fputcsv($stream, ['trends.incidents', (string) $index, json_encode($row)]);
            }
            foreach (($payload['trends']['quality'] ?? []) as $index => $row) {
                fputcsv($stream, ['trends.quality', (string) $index, json_encode($row)]);
            }

            fclose($stream);
        }, 200, $headers);
    }

    private function buildPayload(
        string $from,
        string $to,
        string $preset,
        ?string $hubId = null,
        ?string $subcontractorId = null
    ): array
    {
        $threshold = (float) (DB::table('quality_threshold_settings')
            ->where('scope_type', 'global')
            ->orderByDesc('updated_at')
            ->value('threshold') ?? 95);

        $shipmentsWindow = DB::table('shipments')
            ->whereBetween(DB::raw('DATE(COALESCE(scheduled_at, created_at))'), [$from, $to]);
        $routesWindow = DB::table('routes')
            ->whereBetween('route_date', [$from, $to]);
        $incidentsWindow = DB::table('incidents')
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to]);
        $this->applyShipmentFilters($shipmentsWindow, $hubId, $subcontractorId);
        $this->applyRouteFilters($routesWindow, $hubId, $subcontractorId);
        $this->applyIncidentFilters($incidentsWindow, $hubId, $subcontractorId);

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
            ->when($hubId !== null || $subcontractorId !== null, function ($query) use ($hubId, $subcontractorId): void {
                $query->whereIn('scope_id', function ($routes) use ($hubId, $subcontractorId): void {
                    $routes->select('id')->from('routes');
                    if ($hubId !== null) {
                        $routes->where('hub_id', $hubId);
                    }
                    if ($subcontractorId !== null) {
                        $routes->where('subcontractor_id', $subcontractorId);
                    }
                });
            })
            ->select('scope_id', DB::raw('MAX(service_quality_score) as service_quality_score'))
            ->groupBy('scope_id')
            ->get();
        $driverQualityRows = DB::table('quality_snapshots')
            ->where('scope_type', 'driver')
            ->whereBetween('period_end', [$from, $to])
            ->when($hubId !== null || $subcontractorId !== null, function ($query) use ($hubId, $subcontractorId): void {
                $query->whereIn('scope_id', function ($drivers) use ($hubId, $subcontractorId): void {
                    $drivers->select('id')->from('drivers');
                    if ($hubId !== null) {
                        $drivers->where('home_hub_id', $hubId);
                    }
                    if ($subcontractorId !== null) {
                        $drivers->where('subcontractor_id', $subcontractorId);
                    }
                });
            })
            ->select('scope_id', DB::raw('MAX(service_quality_score) as service_quality_score'))
            ->groupBy('scope_id')
            ->get();
        $routeAvg = $routeQualityRows->count() > 0 ? round((float) $routeQualityRows->avg('service_quality_score'), 2) : 0.0;
        $driverAvg = $driverQualityRows->count() > 0 ? round((float) $driverQualityRows->avg('service_quality_score'), 2) : 0.0;
        $belowThresholdRoutes = $routeQualityRows->filter(fn ($row) => (float) $row->service_quality_score < $threshold)->count();

        $now = Carbon::now();
        $onTrackCount = (clone $incidentsWindow)
            ->whereNull('resolved_at')
            ->where(function ($query) use ($now): void {
                $query->whereNull('sla_due_at')->orWhere('sla_due_at', '>', $now->copy()->addMinutes(60));
            })
            ->count();
        $atRiskCount = (clone $incidentsWindow)
            ->whereNull('resolved_at')
            ->whereNotNull('sla_due_at')
            ->whereBetween('sla_due_at', [$now, $now->copy()->addMinutes(60)])
            ->count();
        $breachedCount = (clone $incidentsWindow)
            ->whereNull('resolved_at')
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', $now)
            ->count();
        $resolvedCount = (clone $incidentsWindow)->whereNotNull('resolved_at')->count();

        $recentRoutes = DB::table('routes')
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->whereBetween('routes.route_date', [$from, $to])
            ->when($hubId !== null, fn ($query) => $query->where('routes.hub_id', $hubId))
            ->when($subcontractorId !== null, fn ($query) => $query->where('routes.subcontractor_id', $subcontractorId))
            ->groupBy('routes.id', 'routes.code', 'routes.route_date', 'routes.status')
            ->select(
                'routes.id',
                'routes.code',
                'routes.route_date',
                'routes.status',
                DB::raw('COUNT(route_stops.id) as stops_count')
            )
            ->orderBy('routes.route_date')
            ->limit(5)
            ->get();
        $recentShipments = DB::table('shipments')
            ->whereBetween(DB::raw('DATE(COALESCE(scheduled_at, created_at))'), [$from, $to])
            ->when($hubId !== null, fn ($query) => $query->where('hub_id', $hubId))
            ->when($subcontractorId !== null, fn ($query) => $query->where('subcontractor_id', $subcontractorId))
            ->select('id', 'reference', 'external_reference', 'status', 'consignee_name', 'service_type')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();
        $recentIncidents = DB::table('incidents')
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to])
            ->when($hubId !== null || $subcontractorId !== null, function ($query) use ($hubId, $subcontractorId): void {
                $this->applyIncidentFilters($query, $hubId, $subcontractorId);
            })
            ->whereNull('resolved_at')
            ->select('id', 'incidentable_type', 'incidentable_id', 'catalog_code', 'category', 'priority', 'sla_due_at', 'notes', 'resolved_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(function ($row) use ($now) {
                $slaStatus = 'on_track';
                if ($row->resolved_at !== null) {
                    $slaStatus = 'resolved';
                } elseif ($row->sla_due_at !== null) {
                    $dueAt = Carbon::parse((string) $row->sla_due_at);
                    if ($dueAt->lessThan($now)) {
                        $slaStatus = 'breached';
                    } elseif ($dueAt->lessThanOrEqualTo($now->copy()->addMinutes(60))) {
                        $slaStatus = 'at_risk';
                    }
                }
                return [
                    'id' => $row->id,
                    'incidentable_type' => $row->incidentable_type,
                    'incidentable_id' => $row->incidentable_id,
                    'catalog_code' => $row->catalog_code,
                    'category' => $row->category,
                    'priority' => $row->priority,
                    'sla_status' => $slaStatus,
                    'notes' => $row->notes,
                    'resolved_at' => $row->resolved_at,
                ];
            })
            ->values();

        $productivityByHub = DB::table('routes')
            ->join('hubs', 'hubs.id', '=', 'routes.hub_id')
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->whereBetween('routes.route_date', [$from, $to])
            ->when($hubId !== null, fn ($query) => $query->where('routes.hub_id', $hubId))
            ->when($subcontractorId !== null, fn ($query) => $query->where('routes.subcontractor_id', $subcontractorId))
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
                return [
                    'hub_id' => $row->hub_id,
                    'hub_code' => $row->hub_code,
                    'hub_name' => $row->hub_name,
                    'routes_total' => (int) $row->routes_total,
                    'routes_completed' => (int) $row->routes_completed,
                    'planned_stops' => $plannedStops,
                    'completed_stops' => $completedStops,
                    'completion_ratio' => $plannedStops > 0 ? round(($completedStops / $plannedStops) * 100, 2) : 0.0,
                ];
            })
            ->values();
        $productivityByRoute = DB::table('routes')
            ->leftJoin('route_stops', 'route_stops.route_id', '=', 'routes.id')
            ->whereBetween('routes.route_date', [$from, $to])
            ->when($hubId !== null, fn ($query) => $query->where('routes.hub_id', $hubId))
            ->when($subcontractorId !== null, fn ($query) => $query->where('routes.subcontractor_id', $subcontractorId))
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
                return [
                    'route_id' => $row->route_id,
                    'route_code' => $row->route_code,
                    'route_date' => (string) $row->route_date,
                    'status' => (string) $row->status,
                    'planned_stops' => $plannedStops,
                    'completed_stops' => $completedStops,
                    'completion_ratio' => $plannedStops > 0 ? round(($completedStops / $plannedStops) * 100, 2) : 0.0,
                ];
            })
            ->values();

        $incidentsOpenCount = (clone $incidentsWindow)->whereNull('resolved_at')->count();
        $shipmentsIncidentCount = (clone $shipmentsWindow)->where('status', 'incident')->count();
        $plannedWithoutDriver = DB::table('routes')
            ->whereBetween('route_date', [$from, $to])
            ->where('status', 'planned')
            ->whereNull('driver_id')
            ->when($hubId !== null, fn ($query) => $query->where('hub_id', $hubId))
            ->when($subcontractorId !== null, fn ($query) => $query->where('subcontractor_id', $subcontractorId))
            ->count();

        $trends = $this->buildTrends($from, $to, $hubId, $subcontractorId);

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

        return [
            'period' => ['from' => $from, 'to' => $to, 'preset' => $preset],
            'filters' => [
                'hub_id' => $hubId,
                'subcontractor_id' => $subcontractorId,
            ],
            'totals' => [
                'shipments' => (clone $shipmentsWindow)->count(),
                'routes' => (clone $routesWindow)->count(),
                'incidents_open' => $incidentsOpenCount,
                'quality_threshold' => $threshold,
            ],
            'sla' => [
                'on_track' => $onTrackCount,
                'at_risk' => $atRiskCount,
                'breached' => $breachedCount,
                'resolved' => $resolvedCount,
            ],
            'shipments_by_status' => $shipmentsByStatus,
            'routes_by_status' => $routesByStatus,
            'quality' => [
                'route_avg' => $routeAvg,
                'driver_avg' => $driverAvg,
                'below_threshold_routes' => $belowThresholdRoutes,
            ],
            'trends' => $trends,
            'recent' => [
                'routes' => $recentRoutes,
                'shipments' => $recentShipments,
                'incidents' => $recentIncidents,
            ],
            'productivity_by_hub' => $productivityByHub,
            'productivity_by_route' => $productivityByRoute,
            'alerts' => $alerts,
        ];
    }

    private function buildTrends(string $from, string $to, ?string $hubId, ?string $subcontractorId): array
    {
        $start = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->startOfDay();

        $shipments = [];
        $routes = [];
        $incidents = [];
        $quality = [];

        for ($cursor = $start->copy(); $cursor->lessThanOrEqualTo($end); $cursor->addDay()) {
            $date = $cursor->toDateString();

            $shipmentsQuery = DB::table('shipments')
                ->whereDate(DB::raw('COALESCE(scheduled_at, created_at)'), $date);
            $this->applyShipmentFilters($shipmentsQuery, $hubId, $subcontractorId);

            $routesQuery = DB::table('routes')->whereDate('route_date', $date);
            $this->applyRouteFilters($routesQuery, $hubId, $subcontractorId);

            $incidentsQuery = DB::table('incidents')->whereDate('created_at', $date);
            $this->applyIncidentFilters($incidentsQuery, $hubId, $subcontractorId);

            $routeQualityQuery = DB::table('quality_snapshots')
                ->where('scope_type', 'route')
                ->whereDate('period_end', $date);
            if ($hubId !== null || $subcontractorId !== null) {
                $routeQualityQuery->whereIn('scope_id', function ($routes) use ($hubId, $subcontractorId): void {
                    $routes->select('id')->from('routes');
                    if ($hubId !== null) {
                        $routes->where('hub_id', $hubId);
                    }
                    if ($subcontractorId !== null) {
                        $routes->where('subcontractor_id', $subcontractorId);
                    }
                });
            }

            $shipments[] = [
                'date' => $date,
                'total' => (clone $shipmentsQuery)->count(),
                'delivered' => (clone $shipmentsQuery)->where('status', 'delivered')->count(),
                'incident' => (clone $shipmentsQuery)->where('status', 'incident')->count(),
            ];
            $routes[] = [
                'date' => $date,
                'total' => (clone $routesQuery)->count(),
                'completed' => (clone $routesQuery)->where('status', 'completed')->count(),
            ];
            $incidents[] = [
                'date' => $date,
                'open' => (clone $incidentsQuery)->whereNull('resolved_at')->count(),
                'resolved' => (clone $incidentsQuery)->whereNotNull('resolved_at')->count(),
            ];
            $quality[] = [
                'date' => $date,
                'route_avg' => round((float) ((clone $routeQualityQuery)->avg('service_quality_score') ?? 0), 2),
            ];
        }

        return [
            'shipments' => $shipments,
            'routes' => $routes,
            'incidents' => $incidents,
            'quality' => $quality,
        ];
    }

    private function applyShipmentFilters($query, ?string $hubId, ?string $subcontractorId): void
    {
        if ($hubId !== null) {
            $query->where('hub_id', $hubId);
        }
        if ($subcontractorId !== null) {
            $query->where('subcontractor_id', $subcontractorId);
        }
    }

    private function applyRouteFilters($query, ?string $hubId, ?string $subcontractorId): void
    {
        if ($hubId !== null) {
            $query->where('hub_id', $hubId);
        }
        if ($subcontractorId !== null) {
            $query->where('subcontractor_id', $subcontractorId);
        }
    }

    private function applyIncidentFilters($query, ?string $hubId, ?string $subcontractorId): void
    {
        if ($hubId === null && $subcontractorId === null) {
            return;
        }

        $query->where(function ($incidentFilter) use ($hubId, $subcontractorId): void {
            $incidentFilter->whereExists(function ($subquery) use ($hubId, $subcontractorId): void {
                $subquery->select(DB::raw(1))
                    ->from('shipments')
                    ->whereColumn('shipments.id', 'incidents.incidentable_id')
                    ->where('incidents.incidentable_type', 'shipment');
                if ($hubId !== null) {
                    $subquery->where('shipments.hub_id', $hubId);
                }
                if ($subcontractorId !== null) {
                    $subquery->where('shipments.subcontractor_id', $subcontractorId);
                }
            })->orWhereExists(function ($subquery) use ($hubId, $subcontractorId): void {
                $subquery->select(DB::raw(1))
                    ->from('pickups')
                    ->whereColumn('pickups.id', 'incidents.incidentable_id')
                    ->where('incidents.incidentable_type', 'pickup');
                if ($hubId !== null) {
                    $subquery->where('pickups.hub_id', $hubId);
                }
                if ($subcontractorId !== null) {
                    $subquery->where('pickups.subcontractor_id', $subcontractorId);
                }
            });
        });
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
