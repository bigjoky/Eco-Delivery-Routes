<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RolePermissionsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_super_admin_can_read_role_detail(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $roleId = (string) DB::table('roles')->where('code', 'operations_manager')->value('id');
        $this->assertNotSame('', $roleId);

        $this->actingAs($admin, 'sanctum');
        $response = $this->getJson("/api/v1/roles/{$roleId}");
        $response->assertOk()
            ->assertJsonPath('data.code', 'operations_manager');
    }

    public function test_super_admin_can_assign_role_permissions_and_audit_timeline_tracks_changes(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $roleId = (string) DB::table('roles')->where('code', 'traffic_operator')->value('id');
        $shipmentReadPermissionId = (string) DB::table('permissions')->where('code', 'shipments.read')->value('id');
        $routesReadPermissionId = (string) DB::table('permissions')->where('code', 'routes.read')->value('id');
        $this->assertNotSame('', $roleId);
        $this->assertNotSame('', $shipmentReadPermissionId);
        $this->assertNotSame('', $routesReadPermissionId);

        $this->actingAs($admin, 'sanctum');
        $updateResponse = $this->putJson("/api/v1/roles/{$roleId}/permissions", [
            'permission_ids' => [$shipmentReadPermissionId, $routesReadPermissionId],
        ]);
        $updateResponse->assertOk();

        $auditResponse = $this->getJson("/api/v1/audit-logs?resource=role&id={$roleId}");
        $auditResponse->assertOk();
        $events = collect($auditResponse->json('data'))->pluck('event')->all();
        $this->assertContains('role.permissions.assigned', $events);
    }

    public function test_operations_manager_cannot_assign_role_permissions(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $roleId = (string) DB::table('roles')->where('code', 'traffic_operator')->value('id');
        $shipmentReadPermissionId = (string) DB::table('permissions')->where('code', 'shipments.read')->value('id');
        $this->assertNotSame('', $roleId);
        $this->assertNotSame('', $shipmentReadPermissionId);

        $this->actingAs($manager, 'sanctum');
        $response = $this->putJson("/api/v1/roles/{$roleId}/permissions", [
            'permission_ids' => [$shipmentReadPermissionId],
        ]);
        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Role Permission ' . $roleCode,
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
