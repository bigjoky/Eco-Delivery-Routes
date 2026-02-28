<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class QualityThresholdAlertSettingsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_default_alert_settings_are_returned(): void
    {
        $viewer = $this->createUserWithRole('viewer');
        $this->actingAs($viewer, 'sanctum');

        $response = $this->getJson('/api/v1/kpis/quality/threshold/alert-settings');
        $response->assertOk();
        $response->assertJsonPath('data.large_delta_threshold', 5);
        $response->assertJsonPath('data.window_hours', 24);
        $response->assertJsonPath('data.source_type', 'default');
    }

    public function test_admin_can_update_alert_settings(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $this->actingAs($admin, 'sanctum');

        $response = $this->putJson('/api/v1/kpis/quality/threshold/alert-settings', [
            'large_delta_threshold' => 2.5,
            'window_hours' => 48,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.large_delta_threshold', 2.5);
        $response->assertJsonPath('data.window_hours', 48);
        $response->assertJsonPath('data.source_type', 'configured');

        $audit = DB::table('audit_logs')
            ->where('event', 'quality.threshold.alert_settings.updated')
            ->latest('id')
            ->first();
        $this->assertNotNull($audit);
    }

    public function test_driver_cannot_update_alert_settings(): void
    {
        $driver = $this->createUserWithRole('driver');
        $this->actingAs($driver, 'sanctum');

        $response = $this->putJson('/api/v1/kpis/quality/threshold/alert-settings', [
            'large_delta_threshold' => 3,
            'window_hours' => 24,
        ]);
        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_large_delta_uses_configurable_threshold(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $this->actingAs($admin, 'sanctum');

        $this->putJson('/api/v1/kpis/quality/threshold/alert-settings', [
            'large_delta_threshold' => 2.0,
            'window_hours' => 24,
        ])->assertOk();

        $this->putJson('/api/v1/kpis/quality/threshold', [
            'threshold' => 95,
            'scope_type' => 'role',
            'scope_id' => 'driver',
        ])->assertOk();

        $this->putJson('/api/v1/kpis/quality/threshold', [
            'threshold' => 92.5,
            'scope_type' => 'role',
            'scope_id' => 'driver',
        ])->assertOk();

        $alert = DB::table('audit_logs')
            ->where('event', 'quality.threshold.alert.large_delta')
            ->latest('id')
            ->first();
        $this->assertNotNull($alert);
        $metadata = json_decode((string) $alert->metadata, true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(2.5, (float) $metadata['delta']);
        $this->assertSame(2.0, (float) $metadata['threshold_delta_trigger']);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Quality Alert Settings ' . $roleCode,
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
