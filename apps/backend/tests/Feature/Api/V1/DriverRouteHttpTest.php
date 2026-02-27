<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DriverRouteHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_driver_me_route_returns_entity_contract_per_stop(): void
    {
        /** @var \App\Models\User|null $user */
        $user = \App\Models\User::query()->where('email', 'admin@eco.local')->first();
        $this->assertNotNull($user);

        $hubId = (string) Str::uuid();
        DB::table('hubs')->insert([
            'id' => $hubId,
            'code' => 'HUB-DRV-' . strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 6)),
            'name' => 'Hub Driver Test',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $subcontractorId = (string) Str::uuid();
        DB::table('subcontractors')->insert([
            'id' => $subcontractorId,
            'legal_name' => 'Sub Driver Test',
            'tax_id' => 'B' . rand(10000000, 99999999),
            'status' => 'active',
            'payment_terms' => 'monthly',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $driverId = (string) Str::uuid();
        DB::table('drivers')->insert([
            'id' => $driverId,
            'user_id' => $user->id,
            'subcontractor_id' => $subcontractorId,
            'home_hub_id' => $hubId,
            'employment_type' => 'subcontractor',
            'code' => 'DRV-TST-' . strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 4)),
            'name' => 'Driver Contract Test',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'driver_id' => $driverId,
            'subcontractor_id' => $subcontractorId,
            'code' => 'R-TST-' . now()->format('YmdHis'),
            'route_date' => now()->toDateString(),
            'status' => 'in_progress',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'route_id' => $routeId,
            'assigned_driver_id' => $driverId,
            'subcontractor_id' => $subcontractorId,
            'reference' => 'SHP-TST-' . strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 6)),
            'service_type' => 'delivery',
            'status' => 'out_for_delivery',
            'consignee_name' => 'Cliente Test',
            'address_line' => 'Calle Test 1',
            'scheduled_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $pickupId = (string) Str::uuid();
        DB::table('pickups')->insert([
            'id' => $pickupId,
            'hub_id' => $hubId,
            'route_id' => $routeId,
            'driver_id' => $driverId,
            'subcontractor_id' => $subcontractorId,
            'reference' => 'PCK-TST-' . strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 6)),
            'pickup_type' => 'NORMAL',
            'status' => 'planned',
            'requester_name' => 'Comercio Test',
            'address_line' => 'Av Test 5',
            'scheduled_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('route_stops')->insert([
            'id' => (string) Str::uuid(),
            'route_id' => $routeId,
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
            'status' => 'in_progress',
            'planned_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('route_stops')->insert([
            'id' => (string) Str::uuid(),
            'route_id' => $routeId,
            'sequence' => 2,
            'stop_type' => 'PICKUP',
            'pickup_id' => $pickupId,
            'status' => 'planned',
            'planned_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/driver/me/route');
        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                'driver' => ['id', 'code', 'name'],
                'route',
                'stops' => [[
                    'id',
                    'route_id',
                    'sequence',
                    'stop_type',
                    'status',
                    'entity_type',
                    'entity_id',
                    'reference',
                ]],
            ],
        ]);

        $stops = $response->json('data.stops');
        $this->assertIsArray($stops);
        $this->assertNotEmpty($stops);

        foreach ($stops as $stop) {
            $this->assertTrue(in_array($stop['entity_type'], ['shipment', 'pickup'], true));
            $this->assertTrue(Str::isUuid((string) $stop['entity_id']));
            if ($stop['entity_type'] === 'shipment') {
                $this->assertSame($stop['shipment_id'], $stop['entity_id']);
            }
            if ($stop['entity_type'] === 'pickup') {
                $this->assertSame($stop['pickup_id'], $stop['entity_id']);
            }
        }
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
