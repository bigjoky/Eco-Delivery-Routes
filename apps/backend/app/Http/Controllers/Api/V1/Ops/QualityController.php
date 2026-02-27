<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
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

        $lines = [
            'Eco Delivery Routes - Quality Routes Report',
            sprintf('Snapshots considered: %d', $rows->count()),
            sprintf('Average score (route): %.2f%%', $avg),
            sprintf('Routes below threshold %.2f%%: %d', $threshold, $belowThreshold),
        ];

        foreach ($rows as $row) {
            $lines[] = sprintf(
                '%s | %s to %s | %.2f%% | completed %d/%d',
                (string) ($row->scope_label ?? $row->scope_id),
                (string) $row->period_start,
                (string) $row->period_end,
                (float) $row->service_quality_score,
                (int) $row->delivered_completed + (int) $row->pickups_completed,
                (int) $row->assigned_with_attempt
            );
        }

        return response($this->buildSimplePdf($lines), 200, [
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

    private function csv(string $value): string
    {
        return '"' . str_replace('"', '""', $value) . '"';
    }

    /**
     * @param array<int,string> $lines
     */
    private function buildSimplePdf(array $lines): string
    {
        $escape = static fn (string $text): string => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $content = "BT\n/F1 12 Tf\n50 780 Td\n";
        foreach ($lines as $i => $line) {
            if ($i > 0) {
                $content .= "0 -18 Td\n";
            }
            $content .= sprintf("(%s) Tj\n", $escape($line));
        }
        $content .= "ET";

        $objects = [];
        $objects[] = "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n";
        $objects[] = "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n";
        $objects[] = "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj\n";
        $objects[] = "4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n";
        $objects[] = "5 0 obj<< /Length " . strlen($content) . " >>stream\n" . $content . "\nendstream endobj\n";

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object;
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        $pdf .= "trailer<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n" . $xrefOffset . "\n%%EOF";

        return $pdf;
    }
}
