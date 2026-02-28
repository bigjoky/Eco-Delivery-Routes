<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class QualityThresholdHistoryHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_history_endpoint_returns_filtered_rows(): void
    {
        $viewer = $this->createUserWithRole('viewer');
        $admin = $this->createUserWithRole('super_admin');

        DB::table('audit_logs')->insert([
            'actor_user_id' => $admin->id,
            'event' => 'quality.threshold.updated',
            'metadata' => json_encode([
                'scope_type' => 'role',
                'scope_id' => 'driver',
                'before' => ['threshold' => 95],
                'after' => ['threshold' => 97],
            ]),
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);
        DB::table('audit_logs')->insert([
            'actor_user_id' => $admin->id,
            'event' => 'quality.threshold.updated',
            'metadata' => json_encode([
                'scope_type' => 'role',
                'scope_id' => 'traffic_operator',
                'before' => ['threshold' => 93],
                'after' => ['threshold' => 91.5],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($viewer, 'sanctum');
        $response = $this->getJson('/api/v1/kpis/quality/threshold/history?scope_type=role&scope_id=driver');

        $response->assertOk();
        $response->assertJsonPath('meta.page', 1);
        $response->assertJsonPath('data.0.scope_type', 'role');
        $response->assertJsonPath('data.0.scope_id', 'driver');
        $row = (array) $response->json('data.0');
        $this->assertSame(95.0, (float) ($row['before_threshold'] ?? 0));
        $this->assertSame(97.0, (float) ($row['after_threshold'] ?? 0));
    }

    public function test_history_csv_export_requires_quality_export_permission(): void
    {
        $driver = $this->createUserWithRole('driver');
        $this->actingAs($driver, 'sanctum');

        $response = $this->get('/api/v1/kpis/quality/threshold/history/export.csv');
        $response->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_history_csv_export_works_for_accountant(): void
    {
        $accountant = $this->createUserWithRole('accountant');
        DB::table('audit_logs')->insert([
            'actor_user_id' => $accountant->id,
            'event' => 'quality.threshold.updated',
            'metadata' => json_encode([
                'scope_type' => 'global',
                'scope_id' => null,
                'before' => ['threshold' => 95],
                'after' => ['threshold' => 96],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($accountant, 'sanctum');
        $response = $this->get('/api/v1/kpis/quality/threshold/history/export.csv?scope_type=global');

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $response->assertSee('before_threshold', false);
        $response->assertSee('96', false);
    }

    public function test_history_pdf_export_works_for_accountant(): void
    {
        $accountant = $this->createUserWithRole('accountant');
        DB::table('audit_logs')->insert([
            'actor_user_id' => $accountant->id,
            'event' => 'quality.threshold.updated',
            'metadata' => json_encode([
                'scope_type' => 'user',
                'scope_id' => (string) $accountant->id,
                'before' => ['threshold' => 94],
                'after' => ['threshold' => 97],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($accountant, 'sanctum');
        $response = $this->get('/api/v1/kpis/quality/threshold/history/export.pdf?scope_type=user&scope_id=' . $accountant->id);

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }

    public function test_large_delta_update_creates_alert_event(): void
    {
        $admin = $this->createUserWithRole('super_admin');
        $this->actingAs($admin, 'sanctum');

        $this->putJson('/api/v1/kpis/quality/threshold', [
            'threshold' => 95,
            'scope_type' => 'role',
            'scope_id' => 'driver',
        ])->assertOk();

        $this->putJson('/api/v1/kpis/quality/threshold', [
            'threshold' => 89,
            'scope_type' => 'role',
            'scope_id' => 'driver',
        ])->assertOk();

        $alert = DB::table('audit_logs')
            ->where('event', 'quality.threshold.alert.large_delta')
            ->latest('id')
            ->first();
        $this->assertNotNull($alert);
        $metadata = json_decode((string) $alert->metadata, true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('role', $metadata['scope_type']);
        $this->assertSame('driver', $metadata['scope_id']);
        $this->assertSame(6.0, (float) $metadata['delta']);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Quality Threshold History ' . $roleCode,
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
