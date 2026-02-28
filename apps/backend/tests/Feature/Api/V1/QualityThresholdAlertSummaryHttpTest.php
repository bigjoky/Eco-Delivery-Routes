<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class QualityThresholdAlertSummaryHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_alert_summary_returns_count_and_last_event(): void
    {
        $viewer = $this->createUserWithRole('viewer');

        DB::table('quality_threshold_alert_settings')->insert([
            'id' => (string) Str::uuid(),
            'large_delta_threshold' => 4.5,
            'window_hours' => 48,
            'updated_by_user_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $viewer->id,
            'event' => 'quality.threshold.alert.large_delta',
            'metadata' => json_encode(['scope_type' => 'role', 'scope_id' => 'driver']),
            'created_at' => now()->subHours(6),
            'updated_at' => now()->subHours(6),
        ]);
        DB::table('audit_logs')->insert([
            'actor_user_id' => $viewer->id,
            'event' => 'quality.threshold.alert.large_delta',
            'metadata' => json_encode(['scope_type' => 'role', 'scope_id' => 'driver']),
            'created_at' => now()->subHours(2),
            'updated_at' => now()->subHours(2),
        ]);

        $this->actingAs($viewer, 'sanctum');
        $response = $this->getJson('/api/v1/kpis/quality/threshold/history/alerts/summary');
        $response->assertOk();
        $response->assertJsonPath('data.count', 2);
        $response->assertJsonPath('data.window_hours', 48);
        $response->assertJsonPath('data.large_delta_threshold', 4.5);
        $response->assertJsonPath('data.event', 'quality.threshold.alert.large_delta');
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Quality Threshold Alert Summary ' . $roleCode,
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
