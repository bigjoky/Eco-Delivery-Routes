<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserMutationsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_super_admin_can_create_user_with_role(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $driverRoleId = (string) DB::table('roles')->where('code', 'driver')->value('id');
        $this->assertNotSame('', $driverRoleId);

        $this->actingAs($admin, 'sanctum');
        $response = $this->postJson('/api/v1/users', [
            'name' => 'Nuevo Driver',
            'email' => 'nuevo.driver@eco.local',
            'password' => 'password123',
            'status' => 'active',
            'role_ids' => [$driverRoleId],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.email', 'nuevo.driver@eco.local')
            ->assertJsonPath('data.status', 'active');
        $this->assertSame('driver', $response->json('data.roles.0.code'));
    }

    public function test_driver_cannot_create_user(): void
    {
        $driver = $this->createUserWithRole('driver');
        $this->actingAs($driver, 'sanctum');

        $response = $this->postJson('/api/v1/users', [
            'name' => 'Sin Permiso',
            'email' => 'sin.permiso@eco.local',
            'password' => 'password123',
            'status' => 'active',
        ]);

        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_create_user_validates_payload(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $this->actingAs($admin, 'sanctum');

        $response = $this->postJson('/api/v1/users', [
            'name' => '',
            'email' => 'not-an-email',
            'password' => '123',
            'status' => 'unknown',
            'role_ids' => ['not-a-uuid'],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name', 'email', 'password', 'status', 'role_ids.0']);
    }

    public function test_user_update_and_assign_roles_are_audited(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $target = $admin;
        $accountantRoleId = (string) DB::table('roles')->where('code', 'accountant')->value('id');
        $superAdminRoleId = (string) DB::table('roles')->where('code', 'super_admin')->value('id');
        $this->assertNotSame('', $accountantRoleId);
        $this->assertNotSame('', $superAdminRoleId);

        $this->actingAs($admin, 'sanctum');
        $updateResponse = $this->patchJson("/api/v1/users/{$target->id}", [
            'status' => 'active',
        ]);
        $updateResponse->assertOk()->assertJsonPath('data.status', 'active');

        $rolesResponse = $this->postJson("/api/v1/users/{$target->id}/roles", [
            'role_ids' => [$superAdminRoleId, $accountantRoleId],
        ]);
        $rolesResponse->assertOk()->assertJsonPath('data.user_id', $target->id);

        $auditResponse = $this->getJson("/api/v1/audit-logs?resource=user&id={$target->id}");
        $auditResponse->assertOk();
        $events = collect($auditResponse->json('data'))->pluck('event')->all();
        $this->assertContains('user.updated', $events);
        $this->assertContains('user.roles.assigned', $events);
    }

    public function test_assign_roles_requires_permission_and_valid_payload(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $target = $this->createUserWithRole('driver');
        $driverRoleId = (string) DB::table('roles')->where('code', 'driver')->value('id');
        $this->assertNotSame('', $driverRoleId);

        $this->actingAs($manager, 'sanctum');
        $forbidden = $this->postJson("/api/v1/users/{$target->id}/roles", [
            'role_ids' => [$driverRoleId],
        ]);
        $forbidden->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');

        $admin = $this->createUserWithRole('super_admin');
        $this->actingAs($admin, 'sanctum');
        $invalid = $this->postJson("/api/v1/users/{$target->id}/roles", [
            'role_ids' => [],
        ]);
        $invalid->assertStatus(422)->assertJsonValidationErrors(['role_ids']);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Mutation ' . $roleCode,
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
