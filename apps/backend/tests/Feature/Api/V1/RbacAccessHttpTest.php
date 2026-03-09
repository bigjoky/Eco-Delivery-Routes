<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RbacAccessHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_driver_cannot_access_advances_list(): void
    {
        $this->actingAs($this->createUserWithRole('driver'), 'sanctum');

        $response = $this->getJson('/api/v1/advances');
        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_accountant_can_access_advances_list(): void
    {
        $this->actingAs($this->createUserWithRole('accountant'), 'sanctum');

        $response = $this->getJson('/api/v1/advances');
        $response->assertOk();
    }

    public function test_traffic_operator_cannot_approve_settlement(): void
    {
        $this->actingAs($this->createUserWithRole('traffic_operator'), 'sanctum');

        $response = $this->postJson('/api/v1/settlements/' . Str::uuid() . '/approve');
        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_driver_cannot_recalculate_quality_snapshot(): void
    {
        $this->actingAs($this->createUserWithRole('driver'), 'sanctum');

        $response = $this->postJson('/api/v1/kpis/quality/recalculate', [
            'scope_type' => 'route',
            'scope_id' => (string) Str::uuid(),
            'period_start' => '2026-02-01',
            'period_end' => '2026-02-28',
        ]);

        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_driver_cannot_export_quality_breakdown_csv(): void
    {
        $this->actingAs($this->createUserWithRole('driver'), 'sanctum');

        $response = $this->get('/api/v1/kpis/quality/subcontractors/' . Str::uuid() . '/breakdown/export.csv');
        $response->assertStatus(403);
    }

    public function test_shipments_operator_with_shipments_write_can_load_hubs_depots_and_points_for_intake(): void
    {
        $user = User::query()->create([
            'name' => 'Shipments Operator',
            'email' => 'shipments.operator.' . substr((string) Str::uuid(), 0, 8) . '@eco.local',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $roleId = (string) Str::uuid();
        DB::table('roles')->insert([
            'id' => $roleId,
            'code' => 'shipments_intake_temp_' . substr((string) Str::uuid(), 0, 8),
            'name' => 'Shipments Intake Temp',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $permissionId = DB::table('permissions')->where('code', 'shipments.write')->value('id');
        $this->assertNotNull($permissionId);
        DB::table('role_permissions')->insert([
            'role_id' => $roleId,
            'permission_id' => $permissionId,
        ]);
        DB::table('user_roles')->insert([
            'user_id' => $user->id,
            'role_id' => $roleId,
        ]);

        $this->actingAs($user, 'sanctum');
        $this->getJson('/api/v1/hubs?only_active=1')->assertOk();
        $this->getJson('/api/v1/depots')->assertOk();
        $this->getJson('/api/v1/points')->assertOk();
    }

    public function test_super_admin_role_bypasses_permission_checks_for_network_write(): void
    {
        $user = User::query()->create([
            'name' => 'Super Admin Bypass',
            'email' => 'superadmin.bypass.' . substr((string) Str::uuid(), 0, 8) . '@eco.local',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $roleId = DB::table('roles')->where('code', 'super_admin')->value('id');
        $this->assertNotNull($roleId);
        DB::table('user_roles')->insert([
            'user_id' => $user->id,
            'role_id' => (string) $roleId,
        ]);

        $this->actingAs($user, 'sanctum');
        $response = $this->postJson('/api/v1/hubs', [
            'name' => 'Hub Bypass',
            'city' => 'Malaga',
        ]);
        $response->assertCreated();
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Role Test ' . $roleCode,
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
