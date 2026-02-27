<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class QualityByRouteHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_can_recalculate_quality_snapshot_for_route_scope(): void
    {
        $routeId = (string) DB::table('routes')->value('id');
        $this->assertNotEmpty($routeId);

        $response = $this->postJson('/api/v1/kpis/quality/recalculate', [
            'scope_type' => 'route',
            'scope_id' => $routeId,
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.scope_type', 'route');
        $response->assertJsonPath('data.scope_id', $routeId);
        $response->assertJsonPath('data.assigned_with_attempt', 1);
    }

    public function test_can_query_routes_under_threshold_and_export_quality_files(): void
    {
        $response = $this->getJson('/api/v1/kpis/quality/top-routes-under-threshold?threshold=95&limit=5');
        $response->assertOk();
        $response->assertJsonStructure([
            'data',
            'meta' => ['threshold', 'count'],
        ]);

        $csv = $this->get('/api/v1/kpis/quality/export.csv?scope_type=route&period_start=' . now()->startOfMonth()->toDateString() . '&period_end=' . now()->endOfMonth()->toDateString());
        $csv->assertOk();
        $csv->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $pdf = $this->get('/api/v1/kpis/quality/export.pdf?scope_type=route');
        $pdf->assertOk();
        $pdf->assertHeader('content-type', 'application/pdf');
    }

    public function test_top_routes_under_threshold_supports_hub_and_period_filters(): void
    {
        $routeA = DB::table('routes')->first();
        $this->assertNotNull($routeA);
        $hubA = (string) $routeA->hub_id;
        $routeAId = (string) $routeA->id;

        $hubB = (string) Str::uuid();
        DB::table('hubs')->insert([
            'id' => $hubB,
            'code' => 'HUB-B',
            'name' => 'Hub B',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $routeBId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeBId,
            'hub_id' => $hubB,
            'driver_id' => $routeA->driver_id,
            'subcontractor_id' => $routeA->subcontractor_id,
            'code' => 'R-TEST-B',
            'route_date' => now()->toDateString(),
            'status' => 'in_progress',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('quality_snapshots')->insert([
            'id' => (string) Str::uuid(),
            'scope_type' => 'route',
            'scope_id' => $routeAId,
            'period_start' => '2026-02-01',
            'period_end' => '2026-02-28',
            'period_granularity' => 'monthly',
            'assigned_with_attempt' => 100,
            'delivered_completed' => 80,
            'failed_count' => 0,
            'absent_count' => 0,
            'retry_count' => 0,
            'pickups_completed' => 5,
            'service_quality_score' => 85.0,
            'calculated_at' => now(),
            'payload' => json_encode(['threshold' => 95]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('quality_snapshots')->insert([
            'id' => (string) Str::uuid(),
            'scope_type' => 'route',
            'scope_id' => $routeBId,
            'period_start' => '2026-01-01',
            'period_end' => '2026-01-31',
            'period_granularity' => 'monthly',
            'assigned_with_attempt' => 100,
            'delivered_completed' => 70,
            'failed_count' => 0,
            'absent_count' => 0,
            'retry_count' => 0,
            'pickups_completed' => 5,
            'service_quality_score' => 75.0,
            'calculated_at' => now(),
            'payload' => json_encode(['threshold' => 95]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/kpis/quality/top-routes-under-threshold?threshold=95&hub_id=' . $hubA . '&period_start=2026-02-01&period_end=2026-02-28');
        $response->assertOk();
        $response->assertJsonPath('meta.count', 1);
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.scope_id', $routeAId);
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
}
