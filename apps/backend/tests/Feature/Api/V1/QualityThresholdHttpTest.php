<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class QualityThresholdHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_default_threshold_is_returned_when_no_setting_exists(): void
    {
        $this->actingAs($this->createUserWithRole('viewer'), 'sanctum');

        $response = $this->getJson('/api/v1/kpis/quality/threshold');
        $response->assertOk();
        $response->assertJsonPath('data.threshold', 95);
        $response->assertJsonPath('data.source_type', 'default');
    }

    public function test_admin_can_set_role_and_user_threshold_and_user_overrides_role(): void
    {
        $admin = $this->createUserWithRole('super_admin');

        $this->actingAs($admin, 'sanctum');
        $setRole = $this->putJson('/api/v1/kpis/quality/threshold', [
            'threshold' => 92.5,
            'scope_type' => 'role',
            'scope_id' => 'super_admin',
        ]);
        $setRole->assertOk();

        $setUser = $this->putJson('/api/v1/kpis/quality/threshold', [
            'threshold' => 97.3,
            'scope_type' => 'user',
        ]);
        $setUser->assertOk();

        $resolved = $this->getJson('/api/v1/kpis/quality/threshold');
        $resolved->assertOk();
        $resolved->assertJsonPath('data.threshold', 97.3);
        $resolved->assertJsonPath('data.source_type', 'user');
        $resolved->assertJsonPath('data.source_id', (string) $admin->id);
    }

    public function test_driver_cannot_update_threshold(): void
    {
        $this->actingAs($this->createUserWithRole('driver'), 'sanctum');

        $response = $this->putJson('/api/v1/kpis/quality/threshold', [
            'threshold' => 94,
            'scope_type' => 'global',
        ]);

        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Quality Threshold ' . $roleCode,
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
