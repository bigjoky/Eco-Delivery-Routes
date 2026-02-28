<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class QualityThresholdAlertTopScopesHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_top_scopes_returns_aggregated_rows(): void
    {
        $viewer = $this->createUserWithRole('viewer');
        $admin = $this->createUserWithRole('super_admin');

        DB::table('audit_logs')->insert([
            'actor_user_id' => $admin->id,
            'event' => 'quality.threshold.alert.large_delta',
            'metadata' => json_encode(['scope_type' => 'role', 'scope_id' => 'driver']),
            'created_at' => now()->subHours(5),
            'updated_at' => now()->subHours(5),
        ]);
        DB::table('audit_logs')->insert([
            'actor_user_id' => $admin->id,
            'event' => 'quality.threshold.alert.large_delta',
            'metadata' => json_encode(['scope_type' => 'role', 'scope_id' => 'driver']),
            'created_at' => now()->subHours(2),
            'updated_at' => now()->subHours(2),
        ]);
        DB::table('audit_logs')->insert([
            'actor_user_id' => $admin->id,
            'event' => 'quality.threshold.alert.large_delta',
            'metadata' => json_encode(['scope_type' => 'global', 'scope_id' => null]),
            'created_at' => now()->subHours(1),
            'updated_at' => now()->subHours(1),
        ]);

        $this->actingAs($viewer, 'sanctum');
        $response = $this->getJson('/api/v1/kpis/quality/threshold/history/alerts/top-scopes?limit=5');
        $response->assertOk();
        $response->assertJsonPath('meta.event', 'quality.threshold.alert.large_delta');
        $response->assertJsonPath('data.0.scope_type', 'role');
        $response->assertJsonPath('data.0.scope_id', 'driver');
        $response->assertJsonPath('data.0.alerts_count', 2);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Quality Threshold Top Scopes ' . $roleCode,
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
