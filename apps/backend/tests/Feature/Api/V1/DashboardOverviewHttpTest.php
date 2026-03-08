<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardOverviewHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_dashboard_overview_returns_expected_blocks(): void
    {
        $response = $this->getJson('/api/v1/dashboard/overview?period=7d');
        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                'period' => ['from', 'to', 'preset'],
                'filters' => ['hub_id', 'subcontractor_id'],
                'totals' => ['shipments', 'routes', 'incidents_open', 'quality_threshold'],
                'sla' => ['on_track', 'at_risk', 'breached', 'resolved'],
                'shipments_by_status',
                'routes_by_status',
                'quality' => ['route_avg', 'driver_avg', 'below_threshold_routes'],
                'trends' => ['shipments', 'routes', 'incidents', 'quality'],
                'recent' => ['routes', 'shipments', 'incidents'],
                'productivity_by_hub',
                'productivity_by_route',
                'alerts',
            ],
        ]);
        $this->assertNotEmpty($response->json('data.trends.shipments'));
    }

    public function test_dashboard_overview_applies_hub_filter(): void
    {
        $baseHubId = (string) DB::table('routes')->value('hub_id');
        $this->assertNotSame('', $baseHubId);

        $otherHubId = (string) Str::uuid();
        DB::table('hubs')->insert([
            'id' => $otherHubId,
            'code' => 'HUB-OTHER',
            'name' => 'Hub Other',
            'city' => 'Sevilla',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('routes')->insert([
            'id' => (string) Str::uuid(),
            'hub_id' => $otherHubId,
            'driver_id' => null,
            'subcontractor_id' => null,
            'code' => 'R-OTHER-HUB',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $all = $this->getJson('/api/v1/dashboard/overview?period=7d');
        $all->assertOk();
        $allRoutes = (int) $all->json('data.totals.routes');

        $filtered = $this->getJson('/api/v1/dashboard/overview?period=7d&hub_id=' . $baseHubId);
        $filtered->assertOk();
        $filtered->assertJsonPath('data.filters.hub_id', $baseHubId);
        $filteredRoutes = (int) $filtered->json('data.totals.routes');

        $this->assertTrue($filteredRoutes < $allRoutes);
        foreach ($filtered->json('data.productivity_by_hub') as $row) {
            $this->assertSame($baseHubId, $row['hub_id']);
        }
    }

    public function test_dashboard_overview_export_csv_returns_file(): void
    {
        $response = $this->get('/api/v1/dashboard/overview/export.csv?period=7d');
        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('section,metric,value', $response->streamedContent());
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
