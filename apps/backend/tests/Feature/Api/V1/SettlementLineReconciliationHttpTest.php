<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SettlementLineReconciliationHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_accountant_can_reconcile_draft_settlement_line_and_totals_are_recomputed(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');

        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        $response = $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
            'exclusion_code' => 'MANUAL_AUDIT',
        ]);

        $response->assertOk()->assertJsonPath('data.line.status', 'excluded');

        $updatedLine = DB::table('settlement_lines')->where('id', $lineId)->first();
        $updatedSettlement = DB::table('settlements')->where('id', $settlementId)->first();

        $this->assertNotNull($updatedLine);
        $this->assertNotNull($updatedSettlement);
        $this->assertSame('excluded', $updatedLine->status);
        $this->assertSame('Ajuste manual de auditoria', $updatedLine->exclusion_reason);
        $this->assertSame(0, (int) $updatedSettlement->gross_amount_cents);
        $this->assertSame(0, (int) $updatedSettlement->net_amount_cents);

        $this->assertTrue(
            DB::table('audit_logs')
                ->where('event', 'settlement.line.reconciled')
                ->whereRaw("json_extract(metadata, '$.settlement_id') = ?", [$settlementId])
                ->exists()
        );
    }

    public function test_excluded_status_requires_catalog_code(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        $response = $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
        ]);

        $response->assertStatus(422);
    }

    public function test_excluded_status_rejects_invalid_catalog_code(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        $response = $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
            'exclusion_code' => 'UNKNOWN_REASON',
        ]);

        $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_driver_cannot_reconcile_settlement_line(): void
    {
        $this->actingAs($this->createUserWithRole('driver'), 'sanctum');
        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        $response = $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
            'exclusion_code' => 'MANUAL_AUDIT',
        ]);

        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_non_draft_settlement_cannot_be_reconciled(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        DB::table('settlements')->where('id', $settlementId)->update([
            'status' => 'approved',
            'updated_at' => now(),
        ]);

        $response = $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
            'exclusion_code' => 'MANUAL_AUDIT',
        ]);

        $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_accountant_can_bulk_reconcile_lines_by_filter(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId] = $this->seedDraftSettlementWithTwoLines();

        $response = $this->postJson("/api/v1/settlements/{$settlementId}/lines/reconcile-bulk", [
            'status' => 'excluded',
            'exclusion_code' => 'RETRY_NOT_PAYABLE',
            'line_type' => 'pickup_normal',
            'current_status' => 'payable',
        ]);

        $response->assertOk()->assertJsonPath('data.affected_count', 1);

        $pickup = DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->where('line_type', 'pickup_normal')
            ->first();
        $delivery = DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->where('line_type', 'shipment_delivery')
            ->first();

        $this->assertNotNull($pickup);
        $this->assertNotNull($delivery);
        $this->assertSame('excluded', $pickup->status);
        $this->assertSame('Reintento no pagable', $pickup->exclusion_reason);
        $this->assertSame('payable', $delivery->status);
    }

    public function test_bulk_preview_returns_impact_totals_without_mutation(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId] = $this->seedDraftSettlementWithTwoLines();

        $response = $this->postJson("/api/v1/settlements/{$settlementId}/lines/reconcile-bulk/preview", [
            'status' => 'excluded',
            'exclusion_code' => 'RETRY_NOT_PAYABLE',
            'line_type' => 'pickup_normal',
            'current_status' => 'payable',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.affected_count', 1)
            ->assertJsonPath('data.before_totals.gross_amount_cents', 440)
            ->assertJsonPath('data.after_totals.gross_amount_cents', 250);

        $pickup = DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->where('line_type', 'pickup_normal')
            ->first();
        $this->assertNotNull($pickup);
        $this->assertSame('payable', $pickup->status);
    }

    public function test_bulk_reconcile_supports_route_filter_and_subcontractor_filter(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId, $targetPickupLineId, $otherPickupLineId, $targetRouteId, $subcontractorId] = $this->seedDraftSettlementWithRouteLinkedPickupLines();

        $response = $this->postJson("/api/v1/settlements/{$settlementId}/lines/reconcile-bulk", [
            'status' => 'excluded',
            'exclusion_code' => 'ABSENCE_NOT_PAYABLE',
            'line_type' => 'pickup_normal',
            'current_status' => 'payable',
            'route_id' => $targetRouteId,
            'subcontractor_id' => $subcontractorId,
        ]);

        $response->assertOk()->assertJsonPath('data.affected_count', 1);

        $target = DB::table('settlement_lines')->where('id', $targetPickupLineId)->first();
        $other = DB::table('settlement_lines')->where('id', $otherPickupLineId)->first();
        $this->assertNotNull($target);
        $this->assertNotNull($other);
        $this->assertSame('excluded', $target->status);
        $this->assertSame('payable', $other->status);
    }

    public function test_reconciliation_reasons_endpoint_returns_catalog(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');

        $response = $this->getJson('/api/v1/settlements/reconciliation-reasons');

        $response->assertOk();
        $response->assertJsonPath('data.0.code', 'ABSENCE_NOT_PAYABLE');
    }

    public function test_reconciliation_summary_groups_exclusions_by_code(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
            'exclusion_code' => 'MANUAL_AUDIT',
        ])->assertOk();

        $response = $this->getJson("/api/v1/settlements/reconciliation-summary?settlement_id={$settlementId}");
        $response->assertOk();
        $response->assertJsonPath('data.0.exclusion_code', 'MANUAL_AUDIT');
        $response->assertJsonPath('data.0.lines_count', 1);
    }

    /**
     * @return array{0:string,1:string}
     */
    private function seedDraftSettlementWithLine(string $lineStatus): array
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $this->assertNotEmpty($subcontractorId);

        $settlementId = (string) Str::uuid();
        $lineId = (string) Str::uuid();

        DB::table('settlements')->insert([
            'id' => $settlementId,
            'subcontractor_id' => $subcontractorId,
            'period_start' => '2026-02-01',
            'period_end' => '2026-02-28',
            'status' => 'draft',
            'gross_amount_cents' => 250,
            'advances_amount_cents' => 0,
            'adjustments_amount_cents' => 0,
            'net_amount_cents' => 250,
            'currency' => 'EUR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('settlement_lines')->insert([
            'id' => $lineId,
            'settlement_id' => $settlementId,
            'line_type' => 'shipment_delivery',
            'source_id' => (string) Str::uuid(),
            'source_ref' => 'SHP-TEST-001',
            'units' => 1,
            'unit_amount_cents' => 250,
            'line_total_cents' => 250,
            'currency' => 'EUR',
            'status' => $lineStatus,
            'exclusion_reason' => null,
            'metadata' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$settlementId, $lineId];
    }

    /**
     * @return array{0:string,1:string,2:string}
     */
    private function seedDraftSettlementWithTwoLines(): array
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $this->assertNotEmpty($subcontractorId);

        $settlementId = (string) Str::uuid();
        $deliveryLineId = (string) Str::uuid();
        $pickupLineId = (string) Str::uuid();

        DB::table('settlements')->insert([
            'id' => $settlementId,
            'subcontractor_id' => $subcontractorId,
            'period_start' => '2026-02-01',
            'period_end' => '2026-02-28',
            'status' => 'draft',
            'gross_amount_cents' => 440,
            'advances_amount_cents' => 0,
            'adjustments_amount_cents' => 0,
            'net_amount_cents' => 440,
            'currency' => 'EUR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('settlement_lines')->insert([
            [
                'id' => $deliveryLineId,
                'settlement_id' => $settlementId,
                'line_type' => 'shipment_delivery',
                'source_id' => (string) Str::uuid(),
                'source_ref' => 'SHP-TEST-002',
                'units' => 1,
                'unit_amount_cents' => 250,
                'line_total_cents' => 250,
                'currency' => 'EUR',
                'status' => 'payable',
                'exclusion_reason' => null,
                'metadata' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $pickupLineId,
                'settlement_id' => $settlementId,
                'line_type' => 'pickup_normal',
                'source_id' => (string) Str::uuid(),
                'source_ref' => 'PCK-TEST-002',
                'units' => 1,
                'unit_amount_cents' => 190,
                'line_total_cents' => 190,
                'currency' => 'EUR',
                'status' => 'payable',
                'exclusion_reason' => null,
                'metadata' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        return [$settlementId, $deliveryLineId, $pickupLineId];
    }

    /**
     * @return array{0:string,1:string,2:string,3:string,4:string}
     */
    private function seedDraftSettlementWithRouteLinkedPickupLines(): array
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $hubId = (string) DB::table('hubs')->value('id');
        $driverId = (string) DB::table('drivers')->value('id');
        $this->assertNotEmpty($subcontractorId);
        $this->assertNotEmpty($hubId);
        $this->assertNotEmpty($driverId);

        $routeA = (string) Str::uuid();
        $routeB = (string) Str::uuid();
        DB::table('routes')->insert([
            [
                'id' => $routeA,
                'hub_id' => $hubId,
                'driver_id' => $driverId,
                'subcontractor_id' => $subcontractorId,
                'code' => 'R-TEST-A',
                'route_date' => '2026-02-15',
                'status' => 'in_progress',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $routeB,
                'hub_id' => $hubId,
                'driver_id' => $driverId,
                'subcontractor_id' => $subcontractorId,
                'code' => 'R-TEST-B',
                'route_date' => '2026-02-16',
                'status' => 'in_progress',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $pickupA = (string) Str::uuid();
        $pickupB = (string) Str::uuid();
        DB::table('pickups')->insert([
            [
                'id' => $pickupA,
                'hub_id' => $hubId,
                'route_id' => $routeA,
                'driver_id' => $driverId,
                'subcontractor_id' => $subcontractorId,
                'reference' => 'PCK-ROUTE-A',
                'pickup_type' => 'NORMAL',
                'status' => 'planned',
                'requester_name' => 'Shop A',
                'address_line' => 'Street A',
                'scheduled_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $pickupB,
                'hub_id' => $hubId,
                'route_id' => $routeB,
                'driver_id' => $driverId,
                'subcontractor_id' => $subcontractorId,
                'reference' => 'PCK-ROUTE-B',
                'pickup_type' => 'NORMAL',
                'status' => 'planned',
                'requester_name' => 'Shop B',
                'address_line' => 'Street B',
                'scheduled_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $settlementId = (string) Str::uuid();
        $lineA = (string) Str::uuid();
        $lineB = (string) Str::uuid();

        DB::table('settlements')->insert([
            'id' => $settlementId,
            'subcontractor_id' => $subcontractorId,
            'period_start' => '2026-02-01',
            'period_end' => '2026-02-28',
            'status' => 'draft',
            'gross_amount_cents' => 380,
            'advances_amount_cents' => 0,
            'adjustments_amount_cents' => 0,
            'net_amount_cents' => 380,
            'currency' => 'EUR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('settlement_lines')->insert([
            [
                'id' => $lineA,
                'settlement_id' => $settlementId,
                'line_type' => 'pickup_normal',
                'source_id' => $pickupA,
                'source_ref' => 'PCK-ROUTE-A',
                'units' => 1,
                'unit_amount_cents' => 190,
                'line_total_cents' => 190,
                'currency' => 'EUR',
                'status' => 'payable',
                'exclusion_reason' => null,
                'metadata' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $lineB,
                'settlement_id' => $settlementId,
                'line_type' => 'pickup_normal',
                'source_id' => $pickupB,
                'source_ref' => 'PCK-ROUTE-B',
                'units' => 1,
                'unit_amount_cents' => 190,
                'line_total_cents' => 190,
                'currency' => 'EUR',
                'status' => 'payable',
                'exclusion_reason' => null,
                'metadata' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        return [$settlementId, $lineA, $lineB, $routeA, $subcontractorId];
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Reconcile Test ' . $roleCode,
            'email' => $roleCode . '.' . substr((string) Str::uuid(), 0, 8) . '@eco.local',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $roleId = DB::table('roles')->where('code', $roleCode)->value('id');
        $this->assertNotNull($roleId);

        DB::table('user_roles')->updateOrInsert([
            'user_id' => $user->id,
            'role_id' => $roleId,
        ]);

        return $user;
    }
}
