<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SettlementWorkflowHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_settlement_state_flow_finalize_approve_export_and_paid(): void
    {
        $this->authenticateAsAdmin();
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');

        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);

        $finalize->assertCreated();
        $settlementId = (string) $finalize->json('data.settlement.id');
        $this->assertNotEmpty($settlementId);

        $approve = $this->postJson("/api/v1/settlements/{$settlementId}/approve");
        $approve->assertOk()->assertJsonPath('data.status', 'approved');

        $export = $this->get("/api/v1/settlements/{$settlementId}/export.csv");
        $export->assertOk();
        $export->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $exportPdf = $this->get("/api/v1/settlements/{$settlementId}/export.pdf");
        $exportPdf->assertOk();
        $exportPdf->assertHeader('content-type', 'application/pdf');

        $markPaid = $this->postJson("/api/v1/settlements/{$settlementId}/mark-paid");
        $markPaid->assertOk()->assertJsonPath('data.status', 'paid');
    }

    public function test_mark_paid_rejects_draft_settlement(): void
    {
        $this->authenticateAsAdmin();
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');

        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $finalize->assertCreated();
        $settlementId = (string) $finalize->json('data.settlement.id');

        $markPaid = $this->postJson("/api/v1/settlements/{$settlementId}/mark-paid");
        $markPaid->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_export_pdf_rejects_draft_settlement(): void
    {
        $this->authenticateAsAdmin();
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');

        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $finalize->assertCreated();
        $settlementId = (string) $finalize->json('data.settlement.id');

        $exportPdf = $this->get("/api/v1/settlements/{$settlementId}/export.pdf");
        $exportPdf->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_subcontractor_quick_search_supports_query_and_limit(): void
    {
        $this->authenticateAsAdmin();

        $response = $this->getJson('/api/v1/subcontractors?q=Ruta&limit=5');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.legal_name', 'Ruta Sur Express SL');
    }

    public function test_advances_export_csv_returns_content(): void
    {
        $this->authenticateAsAdmin();

        $response = $this->get('/api/v1/advances/export.csv?period=' . now()->format('Y-m'));
        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_tariff_update_is_blocked_when_settlement_period_is_closed(): void
    {
        $this->authenticateAsAdmin();
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $tariffId = (string) DB::table('tariffs')->where('subcontractor_id', $subcontractorId)->value('id');
        $this->assertNotEmpty($tariffId);

        DB::table('settlements')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'subcontractor_id' => $subcontractorId,
            'period_start' => '2026-02-01',
            'period_end' => '2026-02-28',
            'status' => 'approved',
            'gross_amount_cents' => 1000,
            'advances_amount_cents' => 0,
            'adjustments_amount_cents' => 0,
            'net_amount_cents' => 1000,
            'currency' => 'EUR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->patchJson('/api/v1/tariffs/' . $tariffId, [
            'amount_cents' => 999,
            'valid_from' => '2026-02-15',
        ]);

        $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_advance_and_tariff_update_audit_include_before_after_metadata(): void
    {
        $this->authenticateAsAdmin();
        $subcontractorId = (string) DB::table('subcontractors')->value('id');

        $createAdvance = $this->postJson('/api/v1/advances', [
            'subcontractor_id' => $subcontractorId,
            'amount_cents' => 5000,
            'currency' => 'EUR',
            'request_date' => now()->toDateString(),
            'reason' => 'QA advance',
        ]);
        $createAdvance->assertCreated();
        $advanceId = (string) $createAdvance->json('data.id');

        $updateAdvance = $this->patchJson("/api/v1/advances/{$advanceId}", [
            'amount_cents' => 6200,
            'reason' => 'QA advance updated',
        ]);
        $updateAdvance->assertOk();

        $advanceAudit = DB::table('audit_logs')
            ->where('event', 'advance.updated')
            ->orderByDesc('id')
            ->first();
        $this->assertNotNull($advanceAudit);
        $advanceMetadata = json_decode((string) $advanceAudit->metadata, true);
        $this->assertIsArray($advanceMetadata);
        $this->assertArrayHasKey('before', $advanceMetadata);
        $this->assertArrayHasKey('after', $advanceMetadata);
        $this->assertSame(5000, $advanceMetadata['before']['amount_cents']);
        $this->assertSame(6200, $advanceMetadata['after']['amount_cents']);

        $tariffId = (string) DB::table('tariffs')->where('subcontractor_id', $subcontractorId)->value('id');
        $this->assertNotEmpty($tariffId);
        $beforeTariffAmount = (int) DB::table('tariffs')->where('id', $tariffId)->value('amount_cents');

        $updateTariff = $this->patchJson("/api/v1/tariffs/{$tariffId}", [
            'amount_cents' => $beforeTariffAmount + 50,
        ]);
        $updateTariff->assertOk();

        $tariffAudit = DB::table('audit_logs')
            ->where('event', 'tariff.updated')
            ->orderByDesc('id')
            ->first();
        $this->assertNotNull($tariffAudit);
        $tariffMetadata = json_decode((string) $tariffAudit->metadata, true);
        $this->assertIsArray($tariffMetadata);
        $this->assertArrayHasKey('before', $tariffMetadata);
        $this->assertArrayHasKey('after', $tariffMetadata);
        $this->assertSame($beforeTariffAmount, $tariffMetadata['before']['amount_cents']);
        $this->assertSame($beforeTariffAmount + 50, $tariffMetadata['after']['amount_cents']);
    }

    private function authenticateAsAdmin(): void
    {
        /** @var \App\Models\User|null $user */
        $user = \App\Models\User::query()->where('email', 'admin@eco.local')->first();
        $this->assertNotNull($user);

        $superAdminRoleId = DB::table('roles')->where('code', 'super_admin')->value('id');
        $this->assertNotNull($superAdminRoleId);
        DB::table('user_roles')->updateOrInsert([
            'user_id' => $user->id,
            'role_id' => $superAdminRoleId,
        ]);

        $this->actingAs($user, 'sanctum');
    }
}
