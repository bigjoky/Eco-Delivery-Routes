<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SettlementAdjustmentController extends Controller
{
    public function index(Request $request, string $settlementId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.read')) {
            return $this->forbidden();
        }

        $settlement = DB::table('settlements')->where('id', $settlementId)->first();
        if (!$settlement) {
            return $this->notFound('Settlement not found.');
        }

        $rows = DB::table('settlement_adjustments')
            ->where('settlement_id', $settlementId)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, string $settlementId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canManageAdjustments($actor)) {
            return $this->forbidden();
        }

        $settlement = DB::table('settlements')->where('id', $settlementId)->first();
        if (!$settlement) {
            return $this->notFound('Settlement not found.');
        }
        if ($settlement->status !== 'draft') {
            return $this->validation('Adjustments can only be created while settlement is draft.');
        }

        $payload = $request->validate([
            'amount_cents' => ['required', 'integer'],
            'reason' => ['required', 'string', 'max:200'],
        ]);

        $id = (string) Str::uuid();
        DB::table('settlement_adjustments')->insert([
            'id' => $id,
            'settlement_id' => $settlementId,
            'amount_cents' => (int) $payload['amount_cents'],
            'currency' => 'EUR',
            'reason' => (string) $payload['reason'],
            'status' => 'pending',
            'created_by_user_id' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'settlement.adjustment.created',
            'metadata' => json_encode(['settlement_id' => $settlementId, 'adjustment_id' => $id]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('settlement_adjustments')->where('id', $id)->first(),
        ], 201);
    }

    public function update(Request $request, string $settlementId, string $adjustmentId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canManageAdjustments($actor)) {
            return $this->forbidden();
        }

        $settlement = DB::table('settlements')->where('id', $settlementId)->first();
        if (!$settlement) {
            return $this->notFound('Settlement not found.');
        }
        if ($settlement->status !== 'draft') {
            return $this->validation('Adjustments can only be edited while settlement is draft.');
        }

        $adjustment = DB::table('settlement_adjustments')
            ->where('id', $adjustmentId)
            ->where('settlement_id', $settlementId)
            ->first();
        if (!$adjustment) {
            return $this->notFound('Adjustment not found.');
        }
        if ($adjustment->status !== 'pending') {
            return $this->validation('Only pending adjustments can be edited.');
        }

        $payload = $request->validate([
            'amount_cents' => ['sometimes', 'integer'],
            'reason' => ['sometimes', 'string', 'max:200'],
        ]);

        $update = ['updated_at' => now()];
        if (array_key_exists('amount_cents', $payload)) {
            $update['amount_cents'] = (int) $payload['amount_cents'];
        }
        if (array_key_exists('reason', $payload)) {
            $update['reason'] = (string) $payload['reason'];
        }

        DB::table('settlement_adjustments')->where('id', $adjustmentId)->update($update);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'settlement.adjustment.updated',
            'metadata' => json_encode(['settlement_id' => $settlementId, 'adjustment_id' => $adjustmentId]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('settlement_adjustments')->where('id', $adjustmentId)->first(),
        ]);
    }

    public function approve(Request $request, string $settlementId, string $adjustmentId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canApproveAdjustments($actor)) {
            return $this->forbidden();
        }

        $settlement = DB::table('settlements')->where('id', $settlementId)->first();
        if (!$settlement) {
            return $this->notFound('Settlement not found.');
        }
        if ($settlement->status !== 'draft') {
            return $this->validation('Adjustments can only be approved while settlement is draft.');
        }

        $adjustment = DB::table('settlement_adjustments')
            ->where('id', $adjustmentId)
            ->where('settlement_id', $settlementId)
            ->first();
        if (!$adjustment) {
            return $this->notFound('Adjustment not found.');
        }
        if ($adjustment->status !== 'pending') {
            return $this->validation('Only pending adjustments can be approved.');
        }

        $approved = false;
        DB::transaction(function () use ($settlementId, $adjustmentId, $adjustment, $actor, &$approved): void {
            $affected = DB::table('settlement_adjustments')
                ->where('id', $adjustmentId)
                ->where('status', 'pending')
                ->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by_user_id' => $actor->id,
                'rejected_at' => null,
                'rejected_by_user_id' => null,
                'rejection_reason' => null,
                'updated_at' => now(),
            ]);
            if ($affected !== 1) {
                return;
            }
            $approved = true;

            DB::table('settlement_lines')->insert([
                'id' => (string) Str::uuid(),
                'settlement_id' => $settlementId,
                'line_type' => 'manual_adjustment',
                'source_id' => $adjustmentId,
                'source_ref' => mb_substr((string) $adjustment->reason, 0, 80),
                'units' => 1,
                'unit_amount_cents' => (int) $adjustment->amount_cents,
                'line_total_cents' => (int) $adjustment->amount_cents,
                'currency' => 'EUR',
                'status' => 'payable',
                'exclusion_reason' => null,
                'metadata' => json_encode(['reason' => $adjustment->reason]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->recomputeSettlementTotals($settlementId);

            DB::table('audit_logs')->insert([
                'actor_user_id' => $actor->id,
                'event' => 'settlement.adjustment.approved',
                'metadata' => json_encode(['settlement_id' => $settlementId, 'adjustment_id' => $adjustmentId]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        if (!$approved) {
            return $this->validation('Only pending adjustments can be approved.');
        }

        return response()->json([
            'data' => DB::table('settlement_adjustments')->where('id', $adjustmentId)->first(),
        ]);
    }

    public function reject(Request $request, string $settlementId, string $adjustmentId): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canApproveAdjustments($actor)) {
            return $this->forbidden();
        }

        $settlement = DB::table('settlements')->where('id', $settlementId)->first();
        if (!$settlement) {
            return $this->notFound('Settlement not found.');
        }
        if ($settlement->status !== 'draft') {
            return $this->validation('Adjustments can only be rejected while settlement is draft.');
        }

        $adjustment = DB::table('settlement_adjustments')
            ->where('id', $adjustmentId)
            ->where('settlement_id', $settlementId)
            ->first();
        if (!$adjustment) {
            return $this->notFound('Adjustment not found.');
        }
        if ($adjustment->status !== 'pending') {
            return $this->validation('Only pending adjustments can be rejected.');
        }

        $payload = $request->validate([
            'reason' => ['required', 'string', 'max:200'],
        ]);

        $affected = DB::table('settlement_adjustments')
            ->where('id', $adjustmentId)
            ->where('status', 'pending')
            ->update([
                'status' => 'rejected',
                'rejected_at' => now(),
                'rejected_by_user_id' => $actor->id,
                'rejection_reason' => (string) $payload['reason'],
                'updated_at' => now(),
            ]);

        if ($affected !== 1) {
            return $this->validation('Only pending adjustments can be rejected.');
        }

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'settlement.adjustment.rejected',
            'metadata' => json_encode(['settlement_id' => $settlementId, 'adjustment_id' => $adjustmentId]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('settlement_adjustments')->where('id', $adjustmentId)->first(),
        ]);
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

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => $message],
        ], 404);
    }

    private function validation(string $message): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'VALIDATION_ERROR', 'message' => $message],
        ], 422);
    }

    private function canManageAdjustments(User $actor): bool
    {
        return $actor->hasRole('accountant') || $actor->hasRole('super_admin');
    }

    private function canApproveAdjustments(User $actor): bool
    {
        if ($actor->hasRole('accountant')) {
            return false;
        }

        return $actor->hasRole('operations_manager') || $actor->hasRole('super_admin');
    }
}
