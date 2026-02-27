<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Application\Settlements\SettlementPreviewBuilder;
use App\Domain\Settlements\SettlementStateMachine;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SettlementController extends Controller
{
    public function __construct(private readonly SettlementPreviewBuilder $previewBuilder)
    {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $query = DB::table('settlements')
            ->leftJoin('subcontractors', 'subcontractors.id', '=', 'settlements.subcontractor_id')
            ->select(
                'settlements.*',
                'subcontractors.legal_name as subcontractor_name'
            );

        if ($request->filled('status')) {
            $query->where('settlements.status', $request->query('status'));
        }

        if ($request->filled('subcontractor_id')) {
            $query->where('settlements.subcontractor_id', $request->query('subcontractor_id'));
        }

        if ($request->filled('period')) {
            $period = (string) $request->query('period');
            if (preg_match('/^\d{4}-\d{2}$/', $period) === 1) {
                $periodStart = $period . '-01';
                $periodEnd = date('Y-m-t', strtotime($periodStart));
                $query->whereDate('settlements.period_start', $periodStart)
                    ->whereDate('settlements.period_end', $periodEnd);
            }
        }

        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $sort = (string) $request->query('sort', 'period_start');
        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['period_start', 'period_end', 'created_at', 'net_amount_cents', 'status'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'period_start';
        }

        $total = (clone $query)->count();
        $rows = $query
            ->orderBy("settlements.{$sort}", $dir)
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

    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $settlement = DB::table('settlements')
            ->leftJoin('subcontractors', 'subcontractors.id', '=', 'settlements.subcontractor_id')
            ->select('settlements.*', 'subcontractors.legal_name as subcontractor_name')
            ->where('settlements.id', $id)
            ->first();

        if (!$settlement) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Settlement not found.'],
            ], 404);
        }

        $lines = DB::table('settlement_lines')
            ->where('settlement_id', $id)
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => [
                'settlement' => $settlement,
                'lines' => $lines,
            ],
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $this->validatePeriodPayload($request);
        $periodStart = $payload['period'] . '-01';
        $periodEnd = date('Y-m-t', strtotime($periodStart));

        $input = $this->buildPreviewInput((string) $payload['subcontractor_id'], $periodStart, $periodEnd);
        if ($input === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Subcontractor not found.'],
            ], 404);
        }

        $preview = $this->previewBuilder->build(
            $input['shipments'],
            $input['pickups'],
            $input['advances'],
            $input['tariffs']
        );

        return response()->json([
            'data' => [
                'subcontractor' => $input['subcontractor'],
                'period' => [
                    'label' => $payload['period'],
                    'start' => $periodStart,
                    'end' => $periodEnd,
                ],
                'tariffs' => $input['tariffs'],
                'totals' => $preview['totals'],
                'lines' => $preview['lines'],
            ],
        ]);
    }

    public function finalize(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $this->validatePeriodPayload($request);
        $periodStart = $payload['period'] . '-01';
        $periodEnd = date('Y-m-t', strtotime($periodStart));

        $input = $this->buildPreviewInput((string) $payload['subcontractor_id'], $periodStart, $periodEnd);
        if ($input === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Subcontractor not found.'],
            ], 404);
        }

        $preview = $this->previewBuilder->build(
            $input['shipments'],
            $input['pickups'],
            $input['advances'],
            $input['tariffs']
        );

        $existing = DB::table('settlements')
            ->where('subcontractor_id', $payload['subcontractor_id'])
            ->whereDate('period_start', $periodStart)
            ->whereDate('period_end', $periodEnd)
            ->whereIn('status', ['draft', 'approved', 'exported', 'paid'])
            ->first();

        if ($existing) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Settlement for period already exists.'],
            ], 422);
        }

        $settlementId = (string) Str::uuid();

        DB::transaction(function () use ($settlementId, $payload, $periodStart, $periodEnd, $preview): void {
            DB::table('settlements')->insert([
                'id' => $settlementId,
                'subcontractor_id' => $payload['subcontractor_id'],
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'status' => 'draft',
                'gross_amount_cents' => $preview['totals']['gross_amount_cents'],
                'advances_amount_cents' => $preview['totals']['advances_amount_cents'],
                'adjustments_amount_cents' => 0,
                'net_amount_cents' => $preview['totals']['net_amount_cents'],
                'currency' => 'EUR',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($preview['lines'] as $line) {
                DB::table('settlement_lines')->insert([
                    'id' => (string) Str::uuid(),
                    'settlement_id' => $settlementId,
                    'line_type' => $line['line_type'],
                    'source_id' => $line['source_id'] ?? null,
                    'source_ref' => $line['source_ref'] ?? null,
                    'units' => $line['units'] ?? 1,
                    'unit_amount_cents' => $line['unit_amount_cents'] ?? 0,
                    'line_total_cents' => $line['line_total_cents'] ?? 0,
                    'currency' => 'EUR',
                    'status' => $line['status'] ?? 'payable',
                    'exclusion_reason' => $line['exclusion_reason'] ?? null,
                    'metadata' => isset($line['metadata']) ? json_encode($line['metadata']) : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $advanceIds = collect($preview['lines'])
                ->where('line_type', 'advance_deduction')
                ->pluck('source_id')
                ->filter()
                ->values();

            if ($advanceIds->isNotEmpty()) {
                DB::table('advances')
                    ->whereIn('id', $advanceIds->all())
                    ->update([
                        'status' => 'deducted',
                        'deducted_for_period' => $periodStart,
                        'updated_at' => now(),
                    ]);
            }
        });

        return response()->json([
            'data' => [
                'settlement' => DB::table('settlements')->where('id', $settlementId)->first(),
                'lines_count' => DB::table('settlement_lines')->where('settlement_id', $settlementId)->count(),
            ],
            'message' => 'Settlement finalized.',
        ], 201);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.approve')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $settlement = DB::table('settlements')->where('id', $id)->first();
        if (!$settlement) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Settlement not found.'],
            ], 404);
        }

        if (!SettlementStateMachine::canApprove($settlement->status)) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Only draft settlements can be approved.'],
            ], 422);
        }

        DB::transaction(function () use ($id, $actor): void {
            DB::table('settlements')->where('id', $id)->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by_user_id' => $actor->id,
                'updated_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'actor_user_id' => $actor->id,
                'event' => 'settlement.approved',
                'metadata' => json_encode(['settlement_id' => $id]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'data' => DB::table('settlements')->where('id', $id)->first(),
            'message' => 'Settlement approved.',
        ]);
    }

    public function recalculate(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $settlement = DB::table('settlements')->where('id', $id)->first();
        if (!$settlement) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Settlement not found.'],
            ], 404);
        }

        if ($settlement->status !== 'draft') {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Only draft settlements can be recalculated.'],
            ], 422);
        }

        $input = $this->buildPreviewInput(
            (string) $settlement->subcontractor_id,
            (string) $settlement->period_start,
            (string) $settlement->period_end
        );
        if ($input === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Subcontractor not found.'],
            ], 404);
        }

        $preview = $this->previewBuilder->build(
            $input['shipments'],
            $input['pickups'],
            $input['advances'],
            $input['tariffs']
        );

        DB::transaction(function () use ($id, $settlement, $preview, $actor): void {
            $existingAdvanceIds = DB::table('settlement_lines')
                ->where('settlement_id', $id)
                ->where('line_type', 'advance_deduction')
                ->whereNotNull('source_id')
                ->pluck('source_id')
                ->all();

            if (!empty($existingAdvanceIds)) {
                DB::table('advances')
                    ->whereIn('id', $existingAdvanceIds)
                    ->where('status', 'deducted')
                    ->where('deducted_for_period', $settlement->period_start)
                    ->update([
                        'status' => 'approved',
                        'deducted_for_period' => null,
                        'updated_at' => now(),
                    ]);
            }

            DB::table('settlement_lines')
                ->where('settlement_id', $id)
                ->where('line_type', '!=', 'manual_adjustment')
                ->delete();

            foreach ($preview['lines'] as $line) {
                DB::table('settlement_lines')->insert([
                    'id' => (string) Str::uuid(),
                    'settlement_id' => $id,
                    'line_type' => $line['line_type'],
                    'source_id' => $line['source_id'] ?? null,
                    'source_ref' => $line['source_ref'] ?? null,
                    'units' => $line['units'] ?? 1,
                    'unit_amount_cents' => $line['unit_amount_cents'] ?? 0,
                    'line_total_cents' => $line['line_total_cents'] ?? 0,
                    'currency' => 'EUR',
                    'status' => $line['status'] ?? 'payable',
                    'exclusion_reason' => $line['exclusion_reason'] ?? null,
                    'metadata' => isset($line['metadata']) ? json_encode($line['metadata']) : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $newAdvanceIds = collect($preview['lines'])
                ->where('line_type', 'advance_deduction')
                ->pluck('source_id')
                ->filter()
                ->values()
                ->all();

            if (!empty($newAdvanceIds)) {
                DB::table('advances')
                    ->whereIn('id', $newAdvanceIds)
                    ->update([
                        'status' => 'deducted',
                        'deducted_for_period' => $settlement->period_start,
                        'updated_at' => now(),
                    ]);
            }

            $this->recomputeSettlementTotals($id);

            DB::table('audit_logs')->insert([
                'actor_user_id' => $actor->id,
                'event' => 'settlement.recalculated',
                'metadata' => json_encode([
                    'settlement_id' => $id,
                    'advances_count' => count($newAdvanceIds),
                    'lines_count' => count($preview['lines']),
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'data' => [
                'settlement' => DB::table('settlements')->where('id', $id)->first(),
                'lines_count' => DB::table('settlement_lines')->where('settlement_id', $id)->count(),
            ],
            'message' => 'Settlement recalculated.',
        ]);
    }

    public function previewRecalculate(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $settlement = DB::table('settlements')->where('id', $id)->first();
        if (!$settlement) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Settlement not found.'],
            ], 404);
        }
        if ($settlement->status !== 'draft') {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Only draft settlements can be preview recalculated.'],
            ], 422);
        }

        $payload = $request->validate([
            'manual_adjustments' => ['sometimes', 'array', 'max:25'],
            'manual_adjustments.*.amount_cents' => ['required_with:manual_adjustments', 'integer'],
            'manual_adjustments.*.reason' => ['required_with:manual_adjustments', 'string', 'max:200'],
        ]);
        /** @var array<int,array{amount_cents:int,reason:string}> $manualAdjustments */
        $manualAdjustments = $payload['manual_adjustments'] ?? [];

        $input = $this->buildPreviewInput(
            (string) $settlement->subcontractor_id,
            (string) $settlement->period_start,
            (string) $settlement->period_end
        );
        if ($input === null) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Subcontractor not found.'],
            ], 404);
        }

        $preview = $this->previewBuilder->build(
            $input['shipments'],
            $input['pickups'],
            $input['advances'],
            $input['tariffs']
        );

        $adjustmentsTotal = 0;
        $normalizedAdjustments = [];
        foreach ($manualAdjustments as $idx => $adjustment) {
            $amount = (int) $adjustment['amount_cents'];
            $reason = (string) $adjustment['reason'];
            $adjustmentsTotal += $amount;
            $normalizedAdjustments[] = [
                'id' => 'preview-adjustment-' . ($idx + 1),
                'line_type' => 'manual_adjustment',
                'source_ref' => mb_substr($reason, 0, 80),
                'line_total_cents' => $amount,
                'status' => 'payable',
                'exclusion_reason' => null,
            ];
        }

        $gross = (int) ($preview['totals']['gross_amount_cents'] ?? 0);
        $advances = (int) ($preview['totals']['advances_amount_cents'] ?? 0);
        $net = $gross - $advances + $adjustmentsTotal;

        return response()->json([
            'data' => [
                'settlement' => [
                    'id' => $settlement->id,
                    'subcontractor_id' => $settlement->subcontractor_id,
                    'period_start' => $settlement->period_start,
                    'period_end' => $settlement->period_end,
                    'status' => $settlement->status,
                    'currency' => $settlement->currency,
                ],
                'totals' => [
                    'gross_amount_cents' => $gross,
                    'advances_amount_cents' => $advances,
                    'adjustments_amount_cents' => $adjustmentsTotal,
                    'net_amount_cents' => $net,
                ],
                'manual_adjustments' => $normalizedAdjustments,
                'lines_count' => count($preview['lines']) + count($normalizedAdjustments),
            ],
        ]);
    }

    public function exportCsv(Request $request, string $id): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.export')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $settlement = DB::table('settlements')->where('id', $id)->first();
        if (!$settlement) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Settlement not found.'],
            ], 404);
        }

        if (!SettlementStateMachine::canExport($settlement->status)) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Settlement must be approved before export.'],
            ], 422);
        }

        $lines = DB::table('settlement_lines')
            ->where('settlement_id', $id)
            ->orderBy('created_at')
            ->get();

        $csvRows = [];
        $csvRows[] = 'line_type,source_ref,status,units,unit_amount_cents,line_total_cents,exclusion_reason';
        foreach ($lines as $line) {
            $csvRows[] = implode(',', [
                $this->csvValue((string) $line->line_type),
                $this->csvValue((string) ($line->source_ref ?? '')),
                $this->csvValue((string) $line->status),
                (int) $line->units,
                (int) $line->unit_amount_cents,
                (int) $line->line_total_cents,
                $this->csvValue((string) ($line->exclusion_reason ?? '')),
            ]);
        }

        DB::transaction(function () use ($id, $actor): void {
            DB::table('settlements')->where('id', $id)->update([
                'status' => 'exported',
                'updated_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'actor_user_id' => $actor->id,
                'event' => 'settlement.exported.csv',
                'metadata' => json_encode(['settlement_id' => $id]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $filename = sprintf('settlement_%s.csv', $id);

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function exportPdf(Request $request, string $id): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.export')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $settlement = DB::table('settlements')
            ->leftJoin('subcontractors', 'subcontractors.id', '=', 'settlements.subcontractor_id')
            ->select('settlements.*', 'subcontractors.legal_name as subcontractor_name')
            ->where('settlements.id', $id)
            ->first();
        if (!$settlement) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Settlement not found.'],
            ], 404);
        }
        if (!SettlementStateMachine::canExport($settlement->status)) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Settlement must be approved before export.'],
            ], 422);
        }

        $quality = DB::table('quality_snapshots')
            ->where('scope_type', 'subcontractor')
            ->where('scope_id', $settlement->subcontractor_id)
            ->whereDate('period_start', '<=', $settlement->period_start)
            ->whereDate('period_end', '>=', $settlement->period_end)
            ->orderByDesc('created_at')
            ->first();

        $auditCount = DB::table('audit_logs')
            ->whereRaw("json_extract(metadata, '$.settlement_id') = ?", [$id])
            ->count();

        $lines = [
            'Eco Delivery Routes - Settlement Report',
            sprintf('Settlement ID: %s', $id),
            sprintf('Subcontractor: %s', (string) ($settlement->subcontractor_name ?? $settlement->subcontractor_id)),
            sprintf('Period: %s to %s', (string) $settlement->period_start, (string) $settlement->period_end),
            sprintf('Gross: %.2f EUR', ((int) $settlement->gross_amount_cents) / 100),
            sprintf('Advances: %.2f EUR', ((int) $settlement->advances_amount_cents) / 100),
            sprintf('Adjustments: %.2f EUR', ((int) $settlement->adjustments_amount_cents) / 100),
            sprintf('Net: %.2f EUR', ((int) $settlement->net_amount_cents) / 100),
            sprintf('Quality KPI (subcontractor): %s', $quality ? $quality->service_quality_score . '%' : 'N/A'),
            sprintf('Audit events linked: %d', $auditCount),
        ];

        $pdfContent = $this->buildSimplePdf($lines);
        $filename = sprintf('settlement_%s.pdf', $id);

        DB::transaction(function () use ($id, $actor): void {
            DB::table('settlements')->where('id', $id)->update([
                'status' => 'exported',
                'updated_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'actor_user_id' => $actor->id,
                'event' => 'settlement.exported.pdf',
                'metadata' => json_encode(['settlement_id' => $id]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response($pdfContent, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function markPaid(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.pay')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $settlement = DB::table('settlements')->where('id', $id)->first();
        if (!$settlement) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Settlement not found.'],
            ], 404);
        }

        if (!SettlementStateMachine::canMarkPaid($settlement->status)) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Settlement must be approved/exported before marking paid.'],
            ], 422);
        }

        DB::transaction(function () use ($id, $actor): void {
            DB::table('settlements')->where('id', $id)->update([
                'status' => 'paid',
                'updated_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'actor_user_id' => $actor->id,
                'event' => 'settlement.paid',
                'metadata' => json_encode(['settlement_id' => $id]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'data' => DB::table('settlements')->where('id', $id)->first(),
            'message' => 'Settlement marked as paid.',
        ]);
    }

    /**
     * @return array<string,int>
     */
    private function resolveTariffs(string $subcontractorId, string $periodStart, string $periodEnd): array
    {
        $rows = DB::table('tariffs')
            ->where('subcontractor_id', $subcontractorId)
            ->where('is_active', true)
            ->whereDate('valid_from', '<=', $periodEnd)
            ->where(function ($query) use ($periodStart) {
                $query->whereNull('valid_to')->orWhereDate('valid_to', '>=', $periodStart);
            })
            ->orderByDesc('valid_from')
            ->get();

        $tariffs = [
            'delivery' => 0,
            'pickup_normal' => 0,
            'pickup_return' => 0,
        ];

        foreach ($rows as $row) {
            if (!isset($tariffs[$row->service_type])) {
                continue;
            }
            if ($tariffs[$row->service_type] === 0) {
                $tariffs[$row->service_type] = (int) $row->amount_cents;
            }
        }

        return $tariffs;
    }

    private function validatePeriodPayload(Request $request): array
    {
        return $request->validate([
            'subcontractor_id' => ['required', 'uuid'],
            'period' => ['required', 'date_format:Y-m'],
        ]);
    }

    /**
     * @return array{
     *   subcontractor:object,
     *   tariffs:array<string,int>,
     *   shipments:array<int,array<string,mixed>>,
     *   pickups:array<int,array<string,mixed>>,
     *   advances:array<int,array<string,mixed>>
     * }|null
     */
    private function buildPreviewInput(string $subcontractorId, string $periodStart, string $periodEnd): ?array
    {
        $subcontractor = DB::table('subcontractors')->where('id', $subcontractorId)->first();
        if (!$subcontractor) {
            return null;
        }

        $tariffs = $this->resolveTariffs($subcontractorId, $periodStart, $periodEnd);

        $shipments = DB::table('shipments')
            ->where('subcontractor_id', $subcontractorId)
            ->whereBetween('created_at', [$periodStart . ' 00:00:00', $periodEnd . ' 23:59:59'])
            ->get()
            ->map(function (object $shipment): array {
                $hasPod = DB::table('pods')
                    ->where('evidenceable_type', 'shipment')
                    ->where('evidenceable_id', $shipment->id)
                    ->exists();

                $incidentCategory = DB::table('incidents')
                    ->where('incidentable_type', 'shipment')
                    ->where('incidentable_id', $shipment->id)
                    ->orderByDesc('created_at')
                    ->value('category');

                return [
                    'id' => $shipment->id,
                    'reference' => $shipment->reference,
                    'status' => $shipment->status,
                    'has_pod' => $hasPod,
                    'incident_category' => $incidentCategory,
                ];
            })
            ->all();

        $pickups = DB::table('pickups')
            ->where('subcontractor_id', $subcontractorId)
            ->whereBetween('created_at', [$periodStart . ' 00:00:00', $periodEnd . ' 23:59:59'])
            ->get()
            ->map(function (object $pickup): array {
                $hasEvidence = DB::table('pods')
                    ->where('evidenceable_type', 'pickup')
                    ->where('evidenceable_id', $pickup->id)
                    ->exists();

                $incidentCategory = DB::table('incidents')
                    ->where('incidentable_type', 'pickup')
                    ->where('incidentable_id', $pickup->id)
                    ->orderByDesc('created_at')
                    ->value('category');

                return [
                    'id' => $pickup->id,
                    'reference' => $pickup->reference,
                    'pickup_type' => $pickup->pickup_type,
                    'status' => $pickup->status,
                    'has_evidence' => $hasEvidence,
                    'incident_category' => $incidentCategory,
                ];
            })
            ->all();

        $advances = DB::table('advances')
            ->where('subcontractor_id', $subcontractorId)
            ->where('status', 'approved')
            ->whereNull('deducted_for_period')
            ->whereBetween('request_date', [$periodStart, $periodEnd])
            ->get()
            ->map(fn (object $advance): array => [
                'id' => $advance->id,
                'amount_cents' => $advance->amount_cents,
                'reason' => $advance->reason,
                'request_date' => $advance->request_date,
            ])
            ->all();

        return [
            'subcontractor' => $subcontractor,
            'tariffs' => $tariffs,
            'shipments' => $shipments,
            'pickups' => $pickups,
            'advances' => $advances,
        ];
    }

    private function csvValue(string $value): string
    {
        $escaped = str_replace('"', '""', $value);
        return '"' . $escaped . '"';
    }

    private function recomputeSettlementTotals(string $settlementId): void
    {
        $gross = (int) DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->whereIn('line_type', ['shipment_delivery', 'pickup_normal', 'pickup_return'])
            ->where('status', 'payable')
            ->sum('line_total_cents');

        $advanceDeductions = (int) DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->where('line_type', 'advance_deduction')
            ->sum('line_total_cents');

        $adjustments = (int) DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->where('line_type', 'manual_adjustment')
            ->where('status', 'payable')
            ->sum('line_total_cents');

        $advancesAmount = abs($advanceDeductions);
        $net = $gross - $advancesAmount + $adjustments;

        DB::table('settlements')->where('id', $settlementId)->update([
            'gross_amount_cents' => $gross,
            'advances_amount_cents' => $advancesAmount,
            'adjustments_amount_cents' => $adjustments,
            'net_amount_cents' => $net,
            'updated_at' => now(),
        ]);
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
