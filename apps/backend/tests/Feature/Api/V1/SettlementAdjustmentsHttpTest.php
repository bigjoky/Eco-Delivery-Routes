<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SettlementAdjustmentsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_create_update_approve_adjustment_and_recompute_settlement_totals(): void
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');

        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $finalize->assertCreated();
        $settlementId = (string) $finalize->json('data.settlement.id');

        $create = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments", [
            'amount_cents' => -300,
            'reason' => 'Correccion incidencia',
        ]);
        $create->assertCreated();
        $adjustmentId = (string) $create->json('data.id');

        $update = $this->patchJson("/api/v1/settlements/{$settlementId}/adjustments/{$adjustmentId}", [
            'amount_cents' => -250,
            'reason' => 'Correccion final',
        ]);
        $update->assertOk()->assertJsonPath('data.amount_cents', -250);

        $beforeNet = (int) DB::table('settlements')->where('id', $settlementId)->value('net_amount_cents');

        $approve = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments/{$adjustmentId}/approve");
        $approve->assertOk()->assertJsonPath('data.status', 'approved');

        $line = DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->where('source_id', $adjustmentId)
            ->first();
        $this->assertNotNull($line);
        $this->assertSame(-250, (int) $line->line_total_cents);

        $after = DB::table('settlements')->where('id', $settlementId)->first();
        $this->assertNotNull($after);
        $this->assertSame(-250, (int) $after->adjustments_amount_cents);
        $this->assertSame($beforeNet - 250, (int) $after->net_amount_cents);
    }

    public function test_double_approve_is_rejected_and_only_one_line_is_created(): void
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');
        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $settlementId = (string) $finalize->json('data.settlement.id');

        $create = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments", [
            'amount_cents' => 100,
            'reason' => 'Bono puntual',
        ]);
        $adjustmentId = (string) $create->json('data.id');

        $first = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments/{$adjustmentId}/approve");
        $first->assertOk();

        $second = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments/{$adjustmentId}/approve");
        $second->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $count = DB::table('settlement_lines')
            ->where('settlement_id', $settlementId)
            ->where('source_id', $adjustmentId)
            ->count();
        $this->assertSame(1, $count);
    }

    public function test_rbac_fine_grained_for_adjustments(): void
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');
        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $settlementId = (string) $finalize->json('data.settlement.id');

        $this->actingAsRole('accountant');
        $create = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments", [
            'amount_cents' => -50,
            'reason' => 'Correccion coste',
        ]);
        $create->assertCreated();
        $adjustmentId = (string) $create->json('data.id');

        $approveDenied = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments/{$adjustmentId}/approve");
        $approveDenied->assertStatus(403);

        $this->actingAsRole('operations_manager');
        $createDenied = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments", [
            'amount_cents' => 100,
            'reason' => 'No debe crear',
        ]);
        $createDenied->assertStatus(403);

        $approve = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments/{$adjustmentId}/approve");
        $approve->assertOk();
    }

    public function test_manager_can_reject_pending_adjustment(): void
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');
        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $settlementId = (string) $finalize->json('data.settlement.id');

        $create = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments", [
            'amount_cents' => 100,
            'reason' => 'Ajuste a rechazar',
        ]);
        $adjustmentId = (string) $create->json('data.id');

        $this->actingAsRole('operations_manager');
        $reject = $this->postJson("/api/v1/settlements/{$settlementId}/adjustments/{$adjustmentId}/reject", [
            'reason' => 'Sin evidencia',
        ]);
        $reject->assertOk()->assertJsonPath('data.status', 'rejected');
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

    private function actingAsRole(string $roleCode): void
    {
        $user = \App\Models\User::query()->create([
            'name' => 'Role ' . $roleCode,
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

        $this->actingAs($user, 'sanctum');
    }
}
