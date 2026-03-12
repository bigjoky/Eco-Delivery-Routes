<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Pdf\BrandedPdfDocument;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QualityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadQuality($actor)) {
            return $this->forbidden();
        }

        $rows = $this->fetchEnrichedQuality($request, 300);

        return response()->json(['data' => $rows->values()]);
    }

    public function topRoutesUnderThreshold(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadDashboardQuality($actor)) {
            return $this->forbidden();
        }

        $threshold = (float) $request->query('threshold', 95);
        $limit = max(1, min((int) $request->query('limit', 10), 100));
        $rows = $this->fetchEnrichedQuality($request, 1000)
            ->filter(fn ($row) => $row->scope_type === 'route')
            ->sortByDesc('period_end')
            ->groupBy('scope_id')
            ->map(fn ($items) => $items->first())
            ->filter(fn ($row) => (float) $row->service_quality_score < $threshold)
            ->sortBy('service_quality_score')
            ->values()
            ->take($limit);

        return response()->json([
            'data' => $rows->values(),
            'meta' => [
                'threshold' => $threshold,
                'count' => $rows->count(),
            ],
        ]);
    }

    public function riskSummary(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadDashboardQuality($actor)) {
            return $this->forbidden();
        }

        $threshold = (float) $request->query('threshold', 95);
        $groupBy = (string) $request->query('group_by', 'hub');
        if (!in_array($groupBy, ['hub', 'subcontractor'], true)) {
            $groupBy = 'hub';
        }

        $rows = $this->fetchEnrichedQuality($request, 2000)
            ->filter(fn ($row) => $row->scope_type === 'route')
            ->sortByDesc('period_end')
            ->groupBy('scope_id')
            ->map(fn ($items) => $items->first())
            ->values();

        $grouped = $rows->groupBy(function ($row) use ($groupBy) {
            return $groupBy === 'hub'
                ? (string) ($row->hub_id ?? 'unknown')
                : (string) ($row->subcontractor_id ?? 'unknown');
        })->map(function ($items, $key) use ($groupBy, $threshold) {
            $count = $items->count();
            $underThreshold = $items->filter(fn ($row) => (float) $row->service_quality_score < $threshold);
            $avgScore = $count > 0
                ? round((float) $items->avg(fn ($row) => (float) $row->service_quality_score), 2)
                : 0.0;
            $worst = $items->sortBy('service_quality_score')->first();

            $label = $key;
            if ($groupBy === 'hub' && $key !== 'unknown') {
                $label = (string) (DB::table('hubs')->where('id', $key)->value('code') ?? $key);
            }
            if ($groupBy === 'subcontractor' && $key !== 'unknown') {
                $label = (string) (DB::table('subcontractors')->where('id', $key)->value('legal_name') ?? $key);
            }

            return [
                'group_type' => $groupBy,
                'group_id' => $key,
                'group_label' => $label,
                'routes_count' => $count,
                'routes_under_threshold' => $underThreshold->count(),
                'under_threshold_ratio' => $count > 0 ? round(($underThreshold->count() / $count) * 100, 2) : 0.0,
                'avg_score' => $avgScore,
                'worst_route_id' => $worst->scope_id ?? null,
                'worst_route_label' => $worst->scope_label ?? $worst->scope_id ?? null,
                'worst_route_score' => $worst->service_quality_score ?? null,
            ];
        })->sortByDesc('under_threshold_ratio')->values();

        return response()->json([
            'data' => $grouped,
            'meta' => [
                'threshold' => $threshold,
                'group_by' => $groupBy,
            ],
        ]);
    }

    public function routeBreakdown(Request $request, string $routeId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadDashboardQuality($actor)) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $routeId)->first();
        if (!$route) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_ROUTE_NOT_FOUND',
                    'message' => 'Route not found.',
                ],
            ], 404);
        }

        return response()->json([
            'data' => $this->buildBreakdownPayload(
                rows: $this->scopeRows($request, 'route', $routeId),
                scopeKey: 'route',
                scopeId: $routeId,
                scopeLabel: $route->code,
                hubId: $route->hub_id,
                subcontractorId: $route->subcontractor_id,
                granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
            ),
        ]);
    }

    public function routeBreakdownExportCsv(Request $request, string $routeId): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $routeId)->first();
        if (!$route) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_ROUTE_NOT_FOUND',
                    'message' => 'Route not found.',
                ],
            ], 404);
        }

        $payload = $this->buildBreakdownPayload(
            rows: $this->scopeRows($request, 'route', $routeId),
            scopeKey: 'route',
            scopeId: $routeId,
            scopeLabel: $route->code,
            hubId: $route->hub_id,
            subcontractorId: $route->subcontractor_id,
            granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
        );

        $csvRows = [
            'scope_type,scope_id,scope_label,granularity,period_key,period_start,period_end,assigned_with_attempt,delivered_completed,pickups_completed,failed_count,absent_count,retry_count,completed_total,completion_ratio',
        ];
        foreach ($payload['periods'] as $period) {
            $csvRows[] = implode(',', [
                $this->csv((string) $payload['scope_type']),
                $this->csv((string) $payload['scope_id']),
                $this->csv((string) ($payload['scope_label'] ?? '')),
                $this->csv((string) $payload['granularity']),
                $this->csv((string) ($period['period_key'] ?? '')),
                $this->csv((string) ($period['period_start'] ?? '')),
                $this->csv((string) ($period['period_end'] ?? '')),
                (string) ($period['components']['assigned_with_attempt'] ?? 0),
                (string) ($period['components']['delivered_completed'] ?? 0),
                (string) ($period['components']['pickups_completed'] ?? 0),
                (string) ($period['components']['failed_count'] ?? 0),
                (string) ($period['components']['absent_count'] ?? 0),
                (string) ($period['components']['retry_count'] ?? 0),
                (string) ($period['components']['completed_total'] ?? 0),
                (string) ($period['components']['completion_ratio'] ?? 0),
            ]);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="quality_route_breakdown.csv"',
        ]);
    }

    public function routeBreakdownExportPdf(Request $request, string $routeId): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $route = DB::table('routes')->where('id', $routeId)->first();
        if (!$route) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_ROUTE_NOT_FOUND',
                    'message' => 'Route not found.',
                ],
            ], 404);
        }

        $payload = $this->buildBreakdownPayload(
            rows: $this->scopeRows($request, 'route', $routeId),
            scopeKey: 'route',
            scopeId: $routeId,
            scopeLabel: $route->code,
            hubId: $route->hub_id,
            subcontractorId: $route->subcontractor_id,
            granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
        );

        $lines = [
            'Eco Delivery Routes - Route Breakdown',
            sprintf('Route: %s', (string) ($payload['scope_label'] ?? $payload['scope_id'])),
            sprintf('Granularity: %s', (string) $payload['granularity']),
            sprintf('Quality score: %.2f%%', (float) $payload['service_quality_score']),
            sprintf('Assigned: %d | Completed: %d', (int) $payload['components']['assigned_with_attempt'], (int) $payload['components']['completed_total']),
        ];
        foreach ($payload['periods'] as $period) {
            $lines[] = sprintf(
                '%s | %.2f%% | completed %d/%d',
                (string) ($period['period_key'] ?? ''),
                (float) ($period['components']['completion_ratio'] ?? 0),
                (int) ($period['components']['completed_total'] ?? 0),
                (int) ($period['components']['assigned_with_attempt'] ?? 0)
            );
        }

        return response($this->buildBreakdownPdf('Ruta', (string) ($payload['scope_label'] ?? $payload['scope_id']), $payload), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="quality_route_breakdown.pdf"',
        ]);
    }

    public function driverBreakdown(Request $request, string $driverId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadDashboardQuality($actor)) {
            return $this->forbidden();
        }

        $driver = DB::table('drivers')->where('id', $driverId)->first();
        if (!$driver) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_DRIVER_NOT_FOUND',
                    'message' => 'Driver not found.',
                ],
            ], 404);
        }

        return response()->json([
            'data' => $this->buildBreakdownPayload(
                rows: $this->scopeRows($request, 'driver', $driverId),
                scopeKey: 'driver',
                scopeId: $driverId,
                scopeLabel: $driver->code ?? $driver->name ?? $driverId,
                hubId: $driver->home_hub_id ?? null,
                subcontractorId: $driver->subcontractor_id ?? null,
                granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
            ),
        ]);
    }

    public function driverBreakdownExportCsv(Request $request, string $driverId): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $driver = DB::table('drivers')->where('id', $driverId)->first();
        if (!$driver) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_DRIVER_NOT_FOUND',
                    'message' => 'Driver not found.',
                ],
            ], 404);
        }

        $payload = $this->buildBreakdownPayload(
            rows: $this->scopeRows($request, 'driver', $driverId),
            scopeKey: 'driver',
            scopeId: $driverId,
            scopeLabel: $driver->code ?? $driver->name ?? $driverId,
            hubId: $driver->home_hub_id ?? null,
            subcontractorId: $driver->subcontractor_id ?? null,
            granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
        );

        $csvRows = [
            'scope_type,scope_id,scope_label,granularity,period_key,period_start,period_end,assigned_with_attempt,delivered_completed,pickups_completed,failed_count,absent_count,retry_count,completed_total,completion_ratio',
        ];
        foreach ($payload['periods'] as $period) {
            $csvRows[] = implode(',', [
                $this->csv((string) $payload['scope_type']),
                $this->csv((string) $payload['scope_id']),
                $this->csv((string) ($payload['scope_label'] ?? '')),
                $this->csv((string) $payload['granularity']),
                $this->csv((string) ($period['period_key'] ?? '')),
                $this->csv((string) ($period['period_start'] ?? '')),
                $this->csv((string) ($period['period_end'] ?? '')),
                (string) ($period['components']['assigned_with_attempt'] ?? 0),
                (string) ($period['components']['delivered_completed'] ?? 0),
                (string) ($period['components']['pickups_completed'] ?? 0),
                (string) ($period['components']['failed_count'] ?? 0),
                (string) ($period['components']['absent_count'] ?? 0),
                (string) ($period['components']['retry_count'] ?? 0),
                (string) ($period['components']['completed_total'] ?? 0),
                (string) ($period['components']['completion_ratio'] ?? 0),
            ]);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="quality_driver_breakdown.csv"',
        ]);
    }

    public function driverBreakdownExportPdf(Request $request, string $driverId): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $driver = DB::table('drivers')->where('id', $driverId)->first();
        if (!$driver) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_DRIVER_NOT_FOUND',
                    'message' => 'Driver not found.',
                ],
            ], 404);
        }

        $payload = $this->buildBreakdownPayload(
            rows: $this->scopeRows($request, 'driver', $driverId),
            scopeKey: 'driver',
            scopeId: $driverId,
            scopeLabel: $driver->code ?? $driver->name ?? $driverId,
            hubId: $driver->home_hub_id ?? null,
            subcontractorId: $driver->subcontractor_id ?? null,
            granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
        );

        $lines = [
            'Eco Delivery Routes - Driver Breakdown',
            sprintf('Driver: %s', (string) ($payload['scope_label'] ?? $payload['scope_id'])),
            sprintf('Granularity: %s', (string) $payload['granularity']),
            sprintf('Quality score: %.2f%%', (float) $payload['service_quality_score']),
            sprintf('Assigned: %d | Completed: %d', (int) $payload['components']['assigned_with_attempt'], (int) $payload['components']['completed_total']),
        ];
        foreach ($payload['periods'] as $period) {
            $lines[] = sprintf(
                '%s | %.2f%% | completed %d/%d',
                (string) ($period['period_key'] ?? ''),
                (float) ($period['components']['completion_ratio'] ?? 0),
                (int) ($period['components']['completed_total'] ?? 0),
                (int) ($period['components']['assigned_with_attempt'] ?? 0)
            );
        }

        return response($this->buildBreakdownPdf('Conductor', (string) ($payload['scope_label'] ?? $payload['scope_id']), $payload), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="quality_driver_breakdown.pdf"',
        ]);
    }

    public function subcontractorBreakdown(Request $request, string $subcontractorId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadDashboardQuality($actor)) {
            return $this->forbidden();
        }

        $subcontractor = DB::table('subcontractors')->where('id', $subcontractorId)->first();
        if (!$subcontractor) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_SUBCONTRACTOR_NOT_FOUND',
                    'message' => 'Subcontractor not found.',
                ],
            ], 404);
        }

        return response()->json([
            'data' => $this->buildBreakdownPayload(
                rows: $this->scopeRows($request, 'subcontractor', $subcontractorId),
                scopeKey: 'subcontractor',
                scopeId: $subcontractorId,
                scopeLabel: $subcontractor->legal_name ?? $subcontractorId,
                hubId: null,
                subcontractorId: $subcontractorId,
                granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
            ),
        ]);
    }

    public function subcontractorBreakdownExportCsv(Request $request, string $subcontractorId): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $subcontractor = DB::table('subcontractors')->where('id', $subcontractorId)->first();
        if (!$subcontractor) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_SUBCONTRACTOR_NOT_FOUND',
                    'message' => 'Subcontractor not found.',
                ],
            ], 404);
        }

        $payload = $this->buildBreakdownPayload(
            rows: $this->scopeRows($request, 'subcontractor', $subcontractorId),
            scopeKey: 'subcontractor',
            scopeId: $subcontractorId,
            scopeLabel: $subcontractor->legal_name ?? $subcontractorId,
            hubId: null,
            subcontractorId: $subcontractorId,
            granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
        );

        $csvRows = [
            'scope_type,scope_id,scope_label,granularity,period_key,period_start,period_end,assigned_with_attempt,delivered_completed,pickups_completed,failed_count,absent_count,retry_count,completed_total,completion_ratio',
        ];
        foreach ($payload['periods'] as $period) {
            $csvRows[] = implode(',', [
                $this->csv((string) $payload['scope_type']),
                $this->csv((string) $payload['scope_id']),
                $this->csv((string) ($payload['scope_label'] ?? '')),
                $this->csv((string) $payload['granularity']),
                $this->csv((string) ($period['period_key'] ?? '')),
                $this->csv((string) ($period['period_start'] ?? '')),
                $this->csv((string) ($period['period_end'] ?? '')),
                (string) ($period['components']['assigned_with_attempt'] ?? 0),
                (string) ($period['components']['delivered_completed'] ?? 0),
                (string) ($period['components']['pickups_completed'] ?? 0),
                (string) ($period['components']['failed_count'] ?? 0),
                (string) ($period['components']['absent_count'] ?? 0),
                (string) ($period['components']['retry_count'] ?? 0),
                (string) ($period['components']['completed_total'] ?? 0),
                (string) ($period['components']['completion_ratio'] ?? 0),
            ]);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="quality_subcontractor_breakdown.csv"',
        ]);
    }

    public function subcontractorBreakdownExportPdf(Request $request, string $subcontractorId): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $subcontractor = DB::table('subcontractors')->where('id', $subcontractorId)->first();
        if (!$subcontractor) {
            return response()->json([
                'error' => [
                    'code' => 'QUALITY_SUBCONTRACTOR_NOT_FOUND',
                    'message' => 'Subcontractor not found.',
                ],
            ], 404);
        }

        $payload = $this->buildBreakdownPayload(
            rows: $this->scopeRows($request, 'subcontractor', $subcontractorId),
            scopeKey: 'subcontractor',
            scopeId: $subcontractorId,
            scopeLabel: $subcontractor->legal_name ?? $subcontractorId,
            hubId: null,
            subcontractorId: $subcontractorId,
            granularity: $this->normalizeBreakdownGranularity((string) $request->query('granularity', 'month'))
        );

        $lines = [
            'Eco Delivery Routes - Subcontractor Breakdown',
            sprintf('Subcontractor: %s', (string) ($payload['scope_label'] ?? $payload['scope_id'])),
            sprintf('Granularity: %s', (string) $payload['granularity']),
            sprintf('Quality score: %.2f%%', (float) $payload['service_quality_score']),
            sprintf('Assigned: %d | Completed: %d', (int) $payload['components']['assigned_with_attempt'], (int) $payload['components']['completed_total']),
        ];
        foreach ($payload['periods'] as $period) {
            $lines[] = sprintf(
                '%s | %.2f%% | completed %d/%d',
                (string) ($period['period_key'] ?? ''),
                (float) ($period['components']['completion_ratio'] ?? 0),
                (int) ($period['components']['completed_total'] ?? 0),
                (int) ($period['components']['assigned_with_attempt'] ?? 0)
            );
        }

        return response($this->buildBreakdownPdf('Subcontrata', (string) ($payload['scope_label'] ?? $payload['scope_id']), $payload), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="quality_subcontractor_breakdown.pdf"',
        ]);
    }

    public function exportCsv(Request $request): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $rows = $this->fetchEnrichedQuality($request, 2000);
        $csvRows = [];
        $csvRows[] = 'id,scope_type,scope_id,scope_label,hub_id,subcontractor_id,period_start,period_end,service_quality_score,assigned_with_attempt,delivered_completed,pickups_completed';
        foreach ($rows as $row) {
            $csvRows[] = implode(',', [
                $this->csv((string) $row->id),
                $this->csv((string) $row->scope_type),
                $this->csv((string) $row->scope_id),
                $this->csv((string) ($row->scope_label ?? '')),
                $this->csv((string) ($row->hub_id ?? '')),
                $this->csv((string) ($row->subcontractor_id ?? '')),
                $this->csv((string) $row->period_start),
                $this->csv((string) $row->period_end),
                (string) $row->service_quality_score,
                (string) $row->assigned_with_attempt,
                (string) $row->delivered_completed,
                (string) $row->pickups_completed,
            ]);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="quality_snapshots_export.csv"',
        ]);
    }

    public function exportPdf(Request $request): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $threshold = (float) $request->query('threshold', 95);
        $rows = $this->fetchEnrichedQuality($request, 200)
            ->filter(fn ($row) => $row->scope_type === 'route')
            ->sortByDesc('period_end')
            ->take(10)
            ->values();

        $avg = $rows->isNotEmpty()
            ? round((float) $rows->avg(fn ($row) => (float) $row->service_quality_score), 2)
            : 0.0;
        $belowThreshold = $rows->filter(fn ($row) => (float) $row->service_quality_score < $threshold)->count();

        return response($this->buildOverviewPdf($rows, $threshold, $avg, $belowThreshold), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="quality_routes_export.pdf"',
        ]);
    }

    public function recalculate(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.recalculate')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'scope_type' => ['required', 'in:driver,subcontractor,route'],
            'scope_id' => ['required', 'uuid'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date'],
        ]);

        $start = $payload['period_start'] . ' 00:00:00';
        $end = $payload['period_end'] . ' 23:59:59';

        $scopeType = (string) $payload['scope_type'];
        $scopeId = (string) $payload['scope_id'];

        $shipmentsBase = DB::table('shipments')->whereBetween('created_at', [$start, $end]);
        $pickupsBase = DB::table('pickups')->whereBetween('created_at', [$start, $end]);

        if ($scopeType === 'driver') {
            $shipmentsBase->where('assigned_driver_id', $scopeId);
            $pickupsBase->where('driver_id', $scopeId);
        } elseif ($scopeType === 'route') {
            $shipmentsBase->where('route_id', $scopeId);
            $pickupsBase->where('route_id', $scopeId);
        } elseif ($scopeType === 'subcontractor') {
            $shipmentsBase->where('subcontractor_id', $scopeId);
            $pickupsBase->where('subcontractor_id', $scopeId);
        }

        $shipmentIds = (clone $shipmentsBase)->pluck('id')->all();
        $pickupIds = (clone $pickupsBase)->pluck('id')->all();

        $assigned = count($shipmentIds);

        $delivered = DB::table('shipments')
            ->whereIn('id', $shipmentIds ?: ['00000000-0000-0000-0000-000000000000'])
            ->where('status', 'delivered')
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $incidentsBase = DB::table('incidents')->whereBetween('created_at', [$start, $end]);
        $failed = (clone $incidentsBase)
            ->where('category', 'failed')
            ->where(function ($q) use ($shipmentIds, $pickupIds): void {
                $q->where(function ($s) use ($shipmentIds): void {
                    $s->where('incidentable_type', 'shipment')
                        ->whereIn('incidentable_id', $shipmentIds ?: ['00000000-0000-0000-0000-000000000000']);
                })->orWhere(function ($p) use ($pickupIds): void {
                    $p->where('incidentable_type', 'pickup')
                        ->whereIn('incidentable_id', $pickupIds ?: ['00000000-0000-0000-0000-000000000000']);
                });
            })
            ->count();

        $absent = (clone $incidentsBase)
            ->where('category', 'absent')
            ->where(function ($q) use ($shipmentIds, $pickupIds): void {
                $q->where(function ($s) use ($shipmentIds): void {
                    $s->where('incidentable_type', 'shipment')
                        ->whereIn('incidentable_id', $shipmentIds ?: ['00000000-0000-0000-0000-000000000000']);
                })->orWhere(function ($p) use ($pickupIds): void {
                    $p->where('incidentable_type', 'pickup')
                        ->whereIn('incidentable_id', $pickupIds ?: ['00000000-0000-0000-0000-000000000000']);
                });
            })
            ->count();

        $retry = (clone $incidentsBase)
            ->where('category', 'retry')
            ->where(function ($q) use ($shipmentIds, $pickupIds): void {
                $q->where(function ($s) use ($shipmentIds): void {
                    $s->where('incidentable_type', 'shipment')
                        ->whereIn('incidentable_id', $shipmentIds ?: ['00000000-0000-0000-0000-000000000000']);
                })->orWhere(function ($p) use ($pickupIds): void {
                    $p->where('incidentable_type', 'pickup')
                        ->whereIn('incidentable_id', $pickupIds ?: ['00000000-0000-0000-0000-000000000000']);
                });
            })
            ->count();

        $pickupsCompleted = DB::table('pickups')
            ->whereIn('id', $pickupIds ?: ['00000000-0000-0000-0000-000000000000'])
            ->where('status', 'completed')
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $quality = $assigned > 0 ? round((($delivered + $pickupsCompleted) / $assigned) * 100, 2) : 0.0;

        $id = (string) Str::uuid();
        DB::table('quality_snapshots')->insert([
            'id' => $id,
            'scope_type' => $payload['scope_type'],
            'scope_id' => $payload['scope_id'],
            'period_start' => $payload['period_start'],
            'period_end' => $payload['period_end'],
            'period_granularity' => 'monthly',
            'assigned_with_attempt' => $assigned,
            'delivered_completed' => $delivered,
            'failed_count' => $failed,
            'absent_count' => $absent,
            'retry_count' => $retry,
            'pickups_completed' => $pickupsCompleted,
            'service_quality_score' => $quality,
            'calculated_at' => now(),
            'payload' => json_encode(['threshold' => 95]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('quality_snapshots')->where('id', $id)->first(),
        ], 201);
    }

    public function threshold(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadQuality($actor)) {
            return $this->forbidden();
        }

        $resolved = $this->resolveQualityThreshold($actor);

        return response()->json([
            'data' => [
                'threshold' => $resolved['threshold'],
                'source_type' => $resolved['source_type'],
                'source_id' => $resolved['source_id'],
                'can_manage' => $actor->hasPermission('quality.recalculate'),
            ],
        ]);
    }

    public function thresholdAlertSettings(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadQuality($actor)) {
            return $this->forbidden();
        }

        $config = $this->resolveThresholdAlertConfig();

        return response()->json([
            'data' => [
                'large_delta_threshold' => $config['large_delta_threshold'],
                'window_hours' => $config['window_hours'],
                'can_manage' => $actor->hasPermission('quality.recalculate'),
                'source_type' => $config['source_type'],
            ],
        ]);
    }

    public function upsertThresholdAlertSettings(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.recalculate')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'large_delta_threshold' => ['required', 'numeric', 'min:0', 'max:100'],
            'window_hours' => ['required', 'integer', 'min:1', 'max:168'],
        ]);

        $existing = DB::table('quality_threshold_alert_settings')->first();
        $before = $existing ? [
            'large_delta_threshold' => (float) $existing->large_delta_threshold,
            'window_hours' => (int) $existing->window_hours,
        ] : null;

        $newDelta = round((float) $payload['large_delta_threshold'], 2);
        $newWindow = (int) $payload['window_hours'];
        if ($existing) {
            DB::table('quality_threshold_alert_settings')
                ->where('id', $existing->id)
                ->update([
                    'large_delta_threshold' => $newDelta,
                    'window_hours' => $newWindow,
                    'updated_by_user_id' => $actor->id,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('quality_threshold_alert_settings')->insert([
                'id' => (string) Str::uuid(),
                'large_delta_threshold' => $newDelta,
                'window_hours' => $newWindow,
                'updated_by_user_id' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'quality.threshold.alert_settings.updated',
            'metadata' => json_encode([
                'before' => $before,
                'after' => [
                    'large_delta_threshold' => $newDelta,
                    'window_hours' => $newWindow,
                ],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'large_delta_threshold' => $newDelta,
                'window_hours' => $newWindow,
                'can_manage' => true,
                'source_type' => 'configured',
            ],
            'message' => 'Threshold alert settings updated.',
        ]);
    }

    public function upsertThreshold(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.recalculate')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'threshold' => ['required', 'numeric', 'min:0', 'max:100'],
            'scope_type' => ['nullable', 'in:global,role,user'],
            'scope_id' => ['nullable', 'string', 'max:255'],
        ]);

        $scopeType = (string) ($payload['scope_type'] ?? 'user');
        $scopeId = isset($payload['scope_id']) ? (string) $payload['scope_id'] : null;

        if ($scopeType === 'global') {
            $scopeId = null;
        }
        if ($scopeType === 'user' && ($scopeId === null || $scopeId === '')) {
            $scopeId = (string) $actor->id;
        }
        if ($scopeType === 'role') {
            if ($scopeId === null || $scopeId === '' || !DB::table('roles')->where('code', $scopeId)->exists()) {
                return response()->json([
                    'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Invalid role scope_id.'],
                ], 422);
            }
        }
        if ($scopeType === 'user' && ($scopeId === null || $scopeId === '')) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Invalid user scope_id.'],
            ], 422);
        }

        $existing = DB::table('quality_threshold_settings')
            ->where('scope_type', $scopeType)
            ->where(function ($query) use ($scopeId): void {
                if ($scopeId === null) {
                    $query->whereNull('scope_id');
                } else {
                    $query->where('scope_id', $scopeId);
                }
            })
            ->first();

        $before = $existing ? [
            'threshold' => round((float) $existing->threshold, 2),
            'scope_type' => (string) $existing->scope_type,
            'scope_id' => $existing->scope_id !== null ? (string) $existing->scope_id : null,
        ] : null;

        $newThreshold = round((float) $payload['threshold'], 2);
        if ($existing) {
            DB::table('quality_threshold_settings')
                ->where('id', $existing->id)
                ->update([
                    'threshold' => $newThreshold,
                    'updated_by_user_id' => $actor->id,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('quality_threshold_settings')->insert([
                'id' => (string) Str::uuid(),
                'scope_type' => $scopeType,
                'scope_id' => $scopeId,
                'threshold' => $newThreshold,
                'updated_by_user_id' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $after = [
            'threshold' => $newThreshold,
            'scope_type' => $scopeType,
            'scope_id' => $scopeId,
        ];
        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'quality.threshold.updated',
            'metadata' => json_encode([
                'scope_type' => $scopeType,
                'scope_id' => $scopeId,
                'before' => $before,
                'after' => $after,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($existing && isset($before['threshold'])) {
            $previousThreshold = (float) $before['threshold'];
            $delta = round(abs($newThreshold - $previousThreshold), 2);
            $alertConfig = $this->resolveThresholdAlertConfig();
            $windowHours = $alertConfig['window_hours'];
            $isRecent = Carbon::parse((string) $existing->updated_at)->greaterThanOrEqualTo(now()->subHours($windowHours));
            $alertThresholdDelta = $alertConfig['large_delta_threshold'];

            if ($isRecent && $delta >= $alertThresholdDelta) {
                DB::table('audit_logs')->insert([
                    'actor_user_id' => $actor->id,
                    'event' => 'quality.threshold.alert.large_delta',
                    'metadata' => json_encode([
                        'scope_type' => $scopeType,
                        'scope_id' => $scopeId,
                        'before' => $before,
                        'after' => $after,
                        'delta' => $delta,
                        'window_hours' => $windowHours,
                        'threshold_delta_trigger' => $alertThresholdDelta,
                    ]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        return response()->json([
            'data' => [
                'threshold' => $newThreshold,
                'source_type' => $scopeType,
                'source_id' => $scopeId,
                'scope_type' => $scopeType,
                'scope_id' => $scopeId,
                'can_manage' => true,
                'updated_by_user_id' => (string) $actor->id,
            ],
            'message' => 'Quality threshold updated.',
        ]);
    }

    public function thresholdHistory(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadQuality($actor)) {
            return $this->forbidden();
        }

        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $query = $this->buildThresholdHistoryQuery($request);
        $total = (clone $query)->count();
        $rows = $query
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(function ($row) {
                $metadata = json_decode((string) ($row->metadata ?? '{}'), true);
                $before = is_array($metadata['before'] ?? null) ? $metadata['before'] : [];
                $after = is_array($metadata['after'] ?? null) ? $metadata['after'] : [];

                return [
                    'id' => (int) $row->id,
                    'event' => (string) $row->event,
                    'actor_user_id' => $row->actor_user_id !== null ? (string) $row->actor_user_id : null,
                    'actor_name' => $row->actor_name !== null ? (string) $row->actor_name : null,
                    'created_at' => (string) $row->created_at,
                    'scope_type' => (string) ($metadata['scope_type'] ?? ''),
                    'scope_id' => isset($metadata['scope_id']) ? (string) $metadata['scope_id'] : null,
                    'before_threshold' => isset($before['threshold']) ? (float) $before['threshold'] : null,
                    'after_threshold' => isset($after['threshold']) ? (float) $after['threshold'] : null,
                    'metadata' => $metadata,
                ];
            })
            ->values();

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

    public function thresholdHistoryAlertsSummary(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadQuality($actor)) {
            return $this->forbidden();
        }

        $config = $this->resolveThresholdAlertConfig();
        $windowHours = $config['window_hours'];
        $dateFrom = (string) $request->query('date_from', now()->subHours($windowHours)->toDateString());
        $dateTo = (string) $request->query('date_to', now()->toDateString());

        $query = $this->buildThresholdHistoryQuery($request, 'quality.threshold.alert.large_delta')
            ->whereDate('audit_logs.created_at', '>=', $dateFrom)
            ->whereDate('audit_logs.created_at', '<=', $dateTo);

        $count = (clone $query)->count();
        $latest = (clone $query)->first();

        return response()->json([
            'data' => [
                'event' => 'quality.threshold.alert.large_delta',
                'count' => $count,
                'last_event_at' => $latest?->created_at,
                'window_hours' => $windowHours,
                'large_delta_threshold' => $config['large_delta_threshold'],
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    public function thresholdHistoryAlertsTopScopes(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canReadQuality($actor)) {
            return $this->forbidden();
        }

        $config = $this->resolveThresholdAlertConfig();
        $windowHours = $config['window_hours'];
        $dateFrom = (string) $request->query('date_from', now()->subHours($windowHours)->toDateString());
        $dateTo = (string) $request->query('date_to', now()->toDateString());
        $limit = max(1, min((int) $request->query('limit', 10), 100));

        $query = $this->buildThresholdHistoryQuery($request, 'quality.threshold.alert.large_delta')
            ->whereDate('audit_logs.created_at', '>=', $dateFrom)
            ->whereDate('audit_logs.created_at', '<=', $dateTo);

        $rows = $query->get()
            ->map(function ($row) {
                $metadata = json_decode((string) ($row->metadata ?? '{}'), true);
                $scopeType = (string) ($metadata['scope_type'] ?? 'unknown');
                $scopeId = isset($metadata['scope_id']) ? (string) $metadata['scope_id'] : null;
                return [
                    'scope_type' => $scopeType,
                    'scope_id' => $scopeId,
                ];
            })
            ->groupBy(fn (array $row) => ($row['scope_type'] ?? 'unknown') . '|' . (string) ($row['scope_id'] ?? ''))
            ->map(function ($items) {
                $first = $items->first();
                $scopeType = (string) ($first['scope_type'] ?? 'unknown');
                $scopeId = isset($first['scope_id']) ? (string) $first['scope_id'] : null;
                return [
                    'scope_type' => $scopeType,
                    'scope_id' => $scopeId,
                    'scope_label' => $this->resolveScopeLabel($scopeType, $scopeId),
                    'alerts_count' => $items->count(),
                ];
            })
            ->sortByDesc('alerts_count')
            ->values()
            ->take($limit)
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'event' => 'quality.threshold.alert.large_delta',
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'limit' => $limit,
                'window_hours' => $windowHours,
            ],
        ]);
    }

    public function thresholdHistoryExportCsv(Request $request): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $rows = $this->buildThresholdHistoryQuery($request)->limit(2000)->get();
        $csvRows = [
            'id,created_at,event,actor_user_id,actor_name,scope_type,scope_id,before_threshold,after_threshold',
        ];

        foreach ($rows as $row) {
            $metadata = json_decode((string) ($row->metadata ?? '{}'), true);
            $before = is_array($metadata['before'] ?? null) ? $metadata['before'] : [];
            $after = is_array($metadata['after'] ?? null) ? $metadata['after'] : [];
            $csvRows[] = implode(',', [
                (string) $row->id,
                $this->csv((string) $row->created_at),
                $this->csv((string) $row->event),
                $this->csv((string) ($row->actor_user_id ?? '')),
                $this->csv((string) ($row->actor_name ?? '')),
                $this->csv((string) ($metadata['scope_type'] ?? '')),
                $this->csv((string) ($metadata['scope_id'] ?? '')),
                isset($before['threshold']) ? (string) ((float) $before['threshold']) : '',
                isset($after['threshold']) ? (string) ((float) $after['threshold']) : '',
            ]);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="quality_threshold_history.csv"',
        ]);
    }

    public function thresholdHistoryExportPdf(Request $request): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('quality.export')) {
            return $this->forbidden();
        }

        $rows = $this->buildThresholdHistoryQuery($request)->limit(120)->get();
        return response($this->buildThresholdHistoryPdf($rows), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="quality_threshold_history.pdf"',
        ]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }

    private function canReadQuality(User $actor): bool
    {
        return $actor->hasPermission('quality.read') || $actor->hasPermission('quality.read.dashboard');
    }

    private function canReadDashboardQuality(User $actor): bool
    {
        return $actor->hasPermission('quality.read.dashboard') || $actor->hasPermission('quality.read');
    }

    /**
     * @return array{threshold:float,source_type:string,source_id:?string}
     */
    private function resolveQualityThreshold(User $actor): array
    {
        $default = 95.0;

        $userSetting = DB::table('quality_threshold_settings')
            ->where('scope_type', 'user')
            ->where('scope_id', (string) $actor->id)
            ->orderByDesc('updated_at')
            ->first();
        if ($userSetting) {
            return [
                'threshold' => round((float) $userSetting->threshold, 2),
                'source_type' => 'user',
                'source_id' => (string) $userSetting->scope_id,
            ];
        }

        $roleCodes = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', (string) $actor->id)
            ->pluck('roles.code')
            ->map(fn ($value) => (string) $value)
            ->all();
        if (!empty($roleCodes)) {
            $roleSetting = DB::table('quality_threshold_settings')
                ->where('scope_type', 'role')
                ->whereIn('scope_id', $roleCodes)
                ->orderByDesc('updated_at')
                ->first();
            if ($roleSetting) {
                return [
                    'threshold' => round((float) $roleSetting->threshold, 2),
                    'source_type' => 'role',
                    'source_id' => (string) $roleSetting->scope_id,
                ];
            }
        }

        $globalSetting = DB::table('quality_threshold_settings')
            ->where('scope_type', 'global')
            ->whereNull('scope_id')
            ->orderByDesc('updated_at')
            ->first();
        if ($globalSetting) {
            return [
                'threshold' => round((float) $globalSetting->threshold, 2),
                'source_type' => 'global',
                'source_id' => null,
            ];
        }

        return [
            'threshold' => $default,
            'source_type' => 'default',
            'source_id' => null,
        ];
    }

    /**
     * @return array{large_delta_threshold:float,window_hours:int,source_type:string}
     */
    private function resolveThresholdAlertConfig(): array
    {
        $defaultDelta = 5.0;
        $defaultWindowHours = 24;

        $row = DB::table('quality_threshold_alert_settings')
            ->orderByDesc('updated_at')
            ->first();
        if ($row) {
            return [
                'large_delta_threshold' => round((float) $row->large_delta_threshold, 2),
                'window_hours' => max(1, (int) $row->window_hours),
                'source_type' => 'configured',
            ];
        }

        return [
            'large_delta_threshold' => $defaultDelta,
            'window_hours' => $defaultWindowHours,
            'source_type' => 'default',
        ];
    }

    private function resolveScopeLabel(string $scopeType, ?string $scopeId): ?string
    {
        if ($scopeType === 'role' && $scopeId !== null && $scopeId !== '') {
            return DB::table('roles')->where('code', $scopeId)->value('name') ?? $scopeId;
        }
        if ($scopeType === 'user' && $scopeId !== null && $scopeId !== '') {
            return DB::table('users')->where('id', $scopeId)->value('name') ?? $scopeId;
        }
        if ($scopeType === 'route' && $scopeId !== null && $scopeId !== '') {
            return DB::table('routes')->where('id', $scopeId)->value('code') ?? $scopeId;
        }
        if ($scopeType === 'subcontractor' && $scopeId !== null && $scopeId !== '') {
            return DB::table('subcontractors')->where('id', $scopeId)->value('legal_name') ?? $scopeId;
        }
        if ($scopeType === 'global') {
            return 'Global';
        }

        return $scopeId;
    }

    private function buildThresholdHistoryQuery(Request $request, ?string $defaultEvent = null)
    {
        $eventFilter = (string) ($request->query('event') ?? $defaultEvent ?? '');
        $query = DB::table('audit_logs')
            ->leftJoin('users', 'users.id', '=', 'audit_logs.actor_user_id')
            ->select('audit_logs.*', 'users.name as actor_name')
            ->where('audit_logs.event', 'like', 'quality.threshold.%')
            ->orderByDesc('audit_logs.created_at');

        if ($eventFilter !== '') {
            $query->where('audit_logs.event', $eventFilter);
        }

        if ($request->filled('scope_type')) {
            $query->whereRaw("json_extract(audit_logs.metadata, '$.scope_type') = ?", [(string) $request->query('scope_type')]);
        }
        if ($request->filled('scope_id')) {
            $query->whereRaw("json_extract(audit_logs.metadata, '$.scope_id') = ?", [(string) $request->query('scope_id')]);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('audit_logs.created_at', '>=', (string) $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('audit_logs.created_at', '<=', (string) $request->query('date_to'));
        }

        return $query;
    }

    private function fetchEnrichedQuality(Request $request, int $limit)
    {
        $query = DB::table('quality_snapshots')
            ->select('quality_snapshots.*')
            ->orderByDesc('period_end');

        if ($request->filled('scope_type')) {
            $query->where('scope_type', $request->query('scope_type'));
        }

        if ($request->filled('scope_id')) {
            $query->where('scope_id', $request->query('scope_id'));
        }

        if ($request->filled('period_start')) {
            $query->whereDate('period_start', '>=', $request->query('period_start'));
        }

        if ($request->filled('period_end')) {
            $query->whereDate('period_end', '<=', $request->query('period_end'));
        }

        $rows = $query->limit($limit)->get();
        $enriched = $rows->map(function ($row) {
            $scopeLabel = null;
            $hubId = null;
            $subcontractorId = null;
            if ($row->scope_type === 'driver') {
                $driver = DB::table('drivers')->where('id', $row->scope_id)->first();
                $scopeLabel = $driver->code ?? null;
                $hubId = $driver->home_hub_id ?? null;
                $subcontractorId = $driver->subcontractor_id ?? null;
            } elseif ($row->scope_type === 'route') {
                $route = DB::table('routes')->where('id', $row->scope_id)->first();
                $scopeLabel = $route->code ?? null;
                $hubId = $route->hub_id ?? null;
                $subcontractorId = $route->subcontractor_id ?? null;
            } elseif ($row->scope_type === 'subcontractor') {
                $scopeLabel = DB::table('subcontractors')->where('id', $row->scope_id)->value('legal_name');
                $subcontractorId = $row->scope_id;
            }
            $row->scope_label = $scopeLabel;
            $row->hub_id = $hubId;
            $row->subcontractor_id = $subcontractorId;
            return $row;
        });

        if ($request->filled('hub_id')) {
            $hubId = (string) $request->query('hub_id');
            $enriched = $enriched->filter(fn ($row) => (string) ($row->hub_id ?? '') === $hubId)->values();
        }

        if ($request->filled('subcontractor_id')) {
            $subcontractorId = (string) $request->query('subcontractor_id');
            $enriched = $enriched->filter(fn ($row) => (string) ($row->subcontractor_id ?? '') === $subcontractorId)->values();
        }

        return $enriched;
    }

    private function scopeRows(Request $request, string $scopeType, string $scopeId)
    {
        return $this->fetchEnrichedQuality($request, 3000)
            ->filter(fn ($row) => (string) $row->scope_type === $scopeType && (string) $row->scope_id === $scopeId)
            ->sortByDesc('period_end')
            ->values();
    }

    private function normalizeBreakdownGranularity(string $granularity): string
    {
        return in_array($granularity, ['week', 'month'], true) ? $granularity : 'month';
    }

    private function buildBreakdownPayload(
        $rows,
        string $scopeKey,
        string $scopeId,
        ?string $scopeLabel,
        ?string $hubId,
        ?string $subcontractorId,
        string $granularity
    ): array {
        $latest = $rows->first();
        $assigned = (int) $rows->sum(fn ($row) => (int) ($row->assigned_with_attempt ?? 0));
        $delivered = (int) $rows->sum(fn ($row) => (int) ($row->delivered_completed ?? 0));
        $pickups = (int) $rows->sum(fn ($row) => (int) ($row->pickups_completed ?? 0));
        $failed = (int) $rows->sum(fn ($row) => (int) ($row->failed_count ?? 0));
        $absent = (int) $rows->sum(fn ($row) => (int) ($row->absent_count ?? 0));
        $retry = (int) $rows->sum(fn ($row) => (int) ($row->retry_count ?? 0));
        $completed = $delivered + $pickups;
        $score = $assigned > 0 ? round(($completed / $assigned) * 100, 2) : 0.0;

        $periods = $rows->groupBy(function ($row) use ($granularity) {
            $end = Carbon::parse((string) $row->period_end);
            if ($granularity === 'week') {
                return $end->format('o-\WW');
            }

            return $end->format('Y-m');
        })->map(function ($items, $periodKey) {
            $start = (string) $items->min('period_start');
            $end = (string) $items->max('period_end');
            $periodAssigned = (int) $items->sum(fn ($row) => (int) ($row->assigned_with_attempt ?? 0));
            $periodDelivered = (int) $items->sum(fn ($row) => (int) ($row->delivered_completed ?? 0));
            $periodPickups = (int) $items->sum(fn ($row) => (int) ($row->pickups_completed ?? 0));
            $periodFailed = (int) $items->sum(fn ($row) => (int) ($row->failed_count ?? 0));
            $periodAbsent = (int) $items->sum(fn ($row) => (int) ($row->absent_count ?? 0));
            $periodRetry = (int) $items->sum(fn ($row) => (int) ($row->retry_count ?? 0));
            $periodCompleted = $periodDelivered + $periodPickups;
            $periodScore = $periodAssigned > 0 ? round(($periodCompleted / $periodAssigned) * 100, 2) : 0.0;

            return [
                'period_key' => (string) $periodKey,
                'period_start' => $start,
                'period_end' => $end,
                'service_quality_score' => $periodScore,
                'components' => [
                    'assigned_with_attempt' => $periodAssigned,
                    'delivered_completed' => $periodDelivered,
                    'pickups_completed' => $periodPickups,
                    'failed_count' => $periodFailed,
                    'absent_count' => $periodAbsent,
                    'retry_count' => $periodRetry,
                    'completed_total' => $periodCompleted,
                    'completion_ratio' => $periodScore,
                ],
            ];
        })->sortBy('period_start')->values();

        return [
            'scope_type' => $scopeKey,
            'scope_id' => $scopeId,
            'scope_label' => $scopeLabel,
            $scopeKey . '_id' => $scopeId,
            $scopeKey . '_code' => $scopeLabel,
            'hub_id' => $hubId,
            'subcontractor_id' => $subcontractorId,
            'granularity' => $granularity,
            'latest_snapshot_id' => $latest->id ?? null,
            'latest_period_start' => $latest->period_start ?? null,
            'latest_period_end' => $latest->period_end ?? null,
            'snapshots_count' => $rows->count(),
            'service_quality_score' => $score,
            'components' => [
                'assigned_with_attempt' => $assigned,
                'delivered_completed' => $delivered,
                'pickups_completed' => $pickups,
                'failed_count' => $failed,
                'absent_count' => $absent,
                'retry_count' => $retry,
                'completed_total' => $completed,
                'completion_ratio' => $score,
            ],
            'periods' => $periods,
        ];
    }

    private function csv(string $value): string
    {
        return '"' . str_replace('"', '""', $value) . '"';
    }

    /**
     * @param array<int,string> $lines
     */
    private function buildSimplePdf(array $lines): string
    {
        return BrandedPdfDocument::renderListDocument(
            title: 'Calidad de servicio',
            subtitle: 'Export corporativo de KPI por expedición, ruta, conductor y subcontrata',
            lines: $lines
        );
    }

    /**
     * @param \Illuminate\Support\Collection<int, object> $rows
     */
    private function buildOverviewPdf($rows, float $threshold, float $avg, int $belowThreshold): string
    {
        $summary = [
            ['label' => 'Snapshots', 'value' => (string) $rows->count()],
            ['label' => 'Media KPI', 'value' => number_format($avg, 2, ',', '.') . '%'],
            ['label' => 'Umbral', 'value' => number_format($threshold, 2, ',', '.') . '%'],
            ['label' => 'Bajo umbral', 'value' => (string) $belowThreshold],
        ];

        $series = [];
        foreach ($rows as $row) {
            $completed = (int) $row->delivered_completed + (int) $row->pickups_completed;
            $series[] = [
                'label' => (string) ($row->scope_label ?? $row->scope_id),
                'value' => number_format((float) $row->service_quality_score, 2, ',', '.') . '%',
                'ratio' => (float) $row->service_quality_score,
                'detail' => sprintf('%s/%s completados · %s a %s', $completed, (int) $row->assigned_with_attempt, (string) $row->period_start, (string) $row->period_end),
            ];
        }

        return BrandedPdfDocument::renderAnalyticsDocument(
            title: 'Calidad de servicio',
            subtitle: 'Resumen visual de calidad por ruta',
            summaryBoxes: $summary,
            series: $series,
            details: []
        );
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function buildBreakdownPdf(string $scopeLabel, string $labelValue, array $payload): string
    {
        $summary = [
            ['label' => 'Scope', 'value' => $scopeLabel],
            ['label' => 'Entidad', 'value' => mb_substr($labelValue, 0, 24)],
            ['label' => 'KPI', 'value' => number_format((float) $payload['service_quality_score'], 2, ',', '.') . '%'],
            ['label' => 'Granularidad', 'value' => (string) $payload['granularity']],
            ['label' => 'Asignados', 'value' => (string) ($payload['components']['assigned_with_attempt'] ?? 0)],
            ['label' => 'Completados', 'value' => (string) ($payload['components']['completed_total'] ?? 0)],
        ];

        $series = [];
        foreach (($payload['periods'] ?? []) as $period) {
            $series[] = [
                'label' => (string) ($period['period_key'] ?? '-'),
                'value' => number_format((float) ($period['components']['completion_ratio'] ?? 0), 2, ',', '.') . '%',
                'ratio' => (float) ($period['components']['completion_ratio'] ?? 0),
                'detail' => sprintf(
                    '%s/%s completados · fallidas %s · ausencias %s · reintentos %s',
                    (string) ($period['components']['completed_total'] ?? 0),
                    (string) ($period['components']['assigned_with_attempt'] ?? 0),
                    (string) ($period['components']['failed_count'] ?? 0),
                    (string) ($period['components']['absent_count'] ?? 0),
                    (string) ($period['components']['retry_count'] ?? 0)
                ),
            ];
        }

        return BrandedPdfDocument::renderAnalyticsDocument(
            title: 'Desglose KPI calidad',
            subtitle: sprintf('%s · %s', $scopeLabel, $labelValue),
            summaryBoxes: $summary,
            series: $series,
            details: []
        );
    }

    /**
     * @param \Illuminate\Support\Collection<int, object> $rows
     */
    private function buildThresholdHistoryPdf($rows): string
    {
        $details = [];
        $changes = 0;
        foreach ($rows as $row) {
            $metadata = json_decode((string) ($row->metadata ?? '{}'), true);
            $before = is_array($metadata['before'] ?? null) ? $metadata['before'] : [];
            $after = is_array($metadata['after'] ?? null) ? $metadata['after'] : [];
            $scopeType = (string) ($metadata['scope_type'] ?? '');
            $scopeId = (string) ($metadata['scope_id'] ?? '');
            $beforeThreshold = isset($before['threshold']) ? (string) ((float) $before['threshold']) : '-';
            $afterThreshold = isset($after['threshold']) ? (string) ((float) $after['threshold']) : '-';
            if ($beforeThreshold !== $afterThreshold) {
                $changes++;
            }
            $details[] = sprintf(
                '%s · %s:%s · %s → %s · %s',
                (string) $row->created_at,
                $scopeType,
                $scopeId,
                $beforeThreshold,
                $afterThreshold,
                (string) $row->event
            );
        }

        return BrandedPdfDocument::renderAnalyticsDocument(
            title: 'Histórico de umbrales KPI',
            subtitle: 'Trazabilidad de cambios y alertas de calidad',
            summaryBoxes: [
                ['label' => 'Filas', 'value' => (string) $rows->count()],
                ['label' => 'Cambios reales', 'value' => (string) $changes],
            ],
            series: [],
            details: $details
        );
    }
}
