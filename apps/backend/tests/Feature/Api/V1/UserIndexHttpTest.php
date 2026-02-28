<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserIndexHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_users_index_supports_filters_and_pagination(): void
    {
        $admin = $this->createUserWithRole('super_admin');

        User::query()->create([
            'name' => 'Maria Operaciones',
            'email' => 'maria.ops@eco.local',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);
        User::query()->create([
            'name' => 'Pedro Suspendido',
            'email' => 'pedro.suspended@eco.local',
            'password' => Hash::make('password123'),
            'status' => 'suspended',
        ]);

        $this->actingAs($admin, 'sanctum');
        $response = $this->getJson('/api/v1/users?q=maria&status=active&page=1&per_page=5&sort=email&dir=asc');

        $response->assertOk();
        $response->assertJsonPath('meta.page', 1);
        $response->assertJsonPath('meta.per_page', 5);
        $rows = $response->json('data');
        $this->assertIsArray($rows);
        $this->assertNotEmpty($rows);
        $this->assertSame('maria.ops@eco.local', $rows[0]['email']);
    }

    public function test_driver_cannot_read_users_index(): void
    {
        $driver = $this->createUserWithRole('driver');
        $this->actingAs($driver, 'sanctum');

        $response = $this->getJson('/api/v1/users');
        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Users Index ' . $roleCode,
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
