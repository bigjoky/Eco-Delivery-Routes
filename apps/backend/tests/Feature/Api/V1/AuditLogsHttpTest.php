<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_can_filter_audit_logs_by_settlement_resource(): void
    {
        $subcontractorId = (string) DB::table('subcontractors')->value('id');
        $period = now()->format('Y-m');

        $finalize = $this->postJson('/api/v1/settlements/finalize', [
            'subcontractor_id' => $subcontractorId,
            'period' => $period,
        ]);
        $settlementId = (string) $finalize->json('data.settlement.id');

        $this->postJson("/api/v1/settlements/{$settlementId}/approve")->assertOk();

        $response = $this->getJson("/api/v1/audit-logs?resource=settlement&id={$settlementId}");
        $response->assertOk();
        $response->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total', 'last_page']]);
        $this->assertGreaterThan(0, count((array) $response->json('data')));
        $first = collect((array) $response->json('data'))->first();
        $this->assertIsArray($first);
        $this->assertArrayHasKey('actor_name', $first);
        $this->assertArrayHasKey('actor_roles', $first);
    }

    public function test_accountant_cannot_read_audit_logs(): void
    {
        $this->actingAsRole('accountant');
        $response = $this->getJson('/api/v1/audit-logs');
        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_can_filter_audit_logs_by_date_range_and_export_csv(): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => null,
            'event' => 'custom.event.old',
            'metadata' => json_encode(['settlement_id' => 'x']),
            'created_at' => '2026-01-10 10:00:00',
            'updated_at' => '2026-01-10 10:00:00',
        ]);
        DB::table('audit_logs')->insert([
            'actor_user_id' => null,
            'event' => 'custom.event.new',
            'metadata' => json_encode(['settlement_id' => 'x']),
            'created_at' => '2026-02-10 10:00:00',
            'updated_at' => '2026-02-10 10:00:00',
        ]);

        $response = $this->getJson('/api/v1/audit-logs?date_from=2026-02-01&date_to=2026-02-28&event=custom.event');
        $response->assertOk();
        $events = collect((array) $response->json('data'))->pluck('event')->all();
        $this->assertContains('custom.event.new', $events);
        $this->assertNotContains('custom.event.old', $events);

        $csv = $this->get('/api/v1/audit-logs/export.csv?date_from=2026-02-01&date_to=2026-02-28&event=custom.event');
        $csv->assertOk();
        $csv->assertHeader('content-type', 'text/csv; charset=UTF-8');
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
