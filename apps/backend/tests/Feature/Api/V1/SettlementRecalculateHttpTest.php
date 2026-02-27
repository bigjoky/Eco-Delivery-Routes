<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class SettlementRecalculateHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_recalculate_draft_settlement_applies_new_approved_advances(): void
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');
        $periodStart = $period . '-01';

        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $finalize->assertCreated();
        $settlementId = (string) $finalize->json('data.settlement.id');
        $baseNet = (int) $finalize->json('data.settlement.net_amount_cents');

        $advanceId = (string) Str::uuid();
        DB::table('advances')->insert([
            'id' => $advanceId,
            'subcontractor_id' => $subcontractorId,
            'amount_cents' => 12345,
            'currency' => 'EUR',
            'status' => 'approved',
            'reason' => 'Advance for recalculate test',
            'request_date' => now()->toDateString(),
            'approved_at' => now(),
            'deducted_for_period' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/settlements/{$settlementId}/recalculate");
        $response->assertOk();
        $response->assertJsonPath('data.settlement.status', 'draft');
        $recalculatedNet = (int) $response->json('data.settlement.net_amount_cents');
        $this->assertLessThan($baseNet, $recalculatedNet);

        $advance = DB::table('advances')->where('id', $advanceId)->first();
        $this->assertNotNull($advance);
        $this->assertSame('deducted', $advance->status);
        $this->assertSame($periodStart, $advance->deducted_for_period);

        $audit = DB::table('audit_logs')
            ->where('event', 'settlement.recalculated')
            ->whereRaw("json_extract(metadata, '$.settlement_id') = ?", [$settlementId])
            ->exists();
        $this->assertTrue($audit);
    }

    public function test_recalculate_rejects_non_draft_settlement(): void
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');

        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $finalize->assertCreated();
        $settlementId = (string) $finalize->json('data.settlement.id');

        $approve = $this->postJson("/api/v1/settlements/{$settlementId}/approve");
        $approve->assertOk();

        $response = $this->postJson("/api/v1/settlements/{$settlementId}/recalculate");
        $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');
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
