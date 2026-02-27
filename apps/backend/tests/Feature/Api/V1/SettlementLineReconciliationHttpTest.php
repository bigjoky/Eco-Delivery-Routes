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
            'exclusion_reason' => 'No pagable por conciliacion manual',
        ]);

        $response->assertOk()->assertJsonPath('data.line.status', 'excluded');

        $updatedLine = DB::table('settlement_lines')->where('id', $lineId)->first();
        $updatedSettlement = DB::table('settlements')->where('id', $settlementId)->first();

        $this->assertNotNull($updatedLine);
        $this->assertNotNull($updatedSettlement);
        $this->assertSame('excluded', $updatedLine->status);
        $this->assertSame('No pagable por conciliacion manual', $updatedLine->exclusion_reason);
        $this->assertSame(0, (int) $updatedSettlement->gross_amount_cents);
        $this->assertSame(0, (int) $updatedSettlement->net_amount_cents);

        $this->assertTrue(
            DB::table('audit_logs')
                ->where('event', 'settlement.line.reconciled')
                ->whereRaw("json_extract(metadata, '$.settlement_id') = ?", [$settlementId])
                ->exists()
        );
    }

    public function test_excluded_status_requires_reason(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');
        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        $response = $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
        ]);

        $response->assertStatus(422);
    }

    public function test_driver_cannot_reconcile_settlement_line(): void
    {
        $this->actingAs($this->createUserWithRole('driver'), 'sanctum');
        [$settlementId, $lineId] = $this->seedDraftSettlementWithLine('payable');

        $response = $this->patchJson("/api/v1/settlements/{$settlementId}/lines/{$lineId}/reconcile", [
            'status' => 'excluded',
            'exclusion_reason' => 'No pagable por conciliacion manual',
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
            'exclusion_reason' => 'No pagable por conciliacion manual',
        ]);

        $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');
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

