<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ShipmentsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_can_filter_shipments_by_reference_query(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        DB::table('shipments')->insert([
            [
                'id' => (string) Str::uuid(),
                'hub_id' => $hubId,
                'reference' => 'SHP-SEARCH-001',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Uno',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'hub_id' => $hubId,
                'reference' => 'SHP-OTHER-002',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Dos',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/v1/shipments?q=SEARCH');
        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $response->assertJsonPath('data.0.reference', 'SHP-SEARCH-001');
    }

    public function test_can_filter_shipments_by_scheduled_date(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();

        DB::table('shipments')->delete();

        DB::table('shipments')->insert([
            [
                'id' => (string) Str::uuid(),
                'hub_id' => $hubId,
                'reference' => 'SHP-DATE-001',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Fecha',
                'scheduled_at' => $today->copy()->addHours(9),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'hub_id' => $hubId,
                'reference' => 'SHP-DATE-002',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Fecha 2',
                'scheduled_at' => $tomorrow->copy()->addHours(10),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $responseTomorrow = $this->getJson('/api/v1/shipments?scheduled_from=' . $tomorrow->toDateString());
        $responseTomorrow->assertOk();
        $this->assertCount(1, $responseTomorrow->json('data'));
        $responseTomorrow->assertJsonPath('data.0.reference', 'SHP-DATE-002');

        $responseToday = $this->getJson('/api/v1/shipments?scheduled_from=' . $today->toDateString() . '&scheduled_to=' . $today->toDateString());
        $responseToday->assertOk();
        $this->assertCount(1, $responseToday->json('data'));
        $responseToday->assertJsonPath('data.0.reference', 'SHP-DATE-001');
    }

    public function test_rejects_scheduled_at_outside_allowed_window(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $payload = [
            'hub_id' => $hubId,
            'reference' => 'SHP-FUTURE-001',
            'consignee_name' => 'Cliente Futuro',
            'scheduled_at' => now()->addDays(365)->toDateTimeString(),
        ];

        $response = $this->postJson('/api/v1/shipments', $payload);
        $response->assertStatus(422);
    }

    public function test_can_show_shipment_detail_with_tracking_pods_incidents(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-TEST-001',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'route_id' => $routeId,
            'reference' => 'SHP-DETAIL-001',
            'status' => 'created',
            'service_type' => 'delivery',
            'consignee_name' => 'Cliente Detalle',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('route_stops')->insert([
            'id' => (string) Str::uuid(),
            'route_id' => $routeId,
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('tracking_events')->insert([
            'trackable_type' => 'shipment',
            'trackable_id' => $shipmentId,
            'event_code' => 'CREATED',
            'status_to' => 'created',
            'source' => 'test',
            'occurred_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('pods')->insert([
            'id' => (string) Str::uuid(),
            'evidenceable_type' => 'shipment',
            'evidenceable_id' => $shipmentId,
            'signature_name' => 'Test Sign',
            'captured_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('incidents')->insert([
            'id' => (string) Str::uuid(),
            'incidentable_type' => 'shipment',
            'incidentable_id' => $shipmentId,
            'catalog_code' => 'ADDR_ERR',
            'category' => 'general',
            'notes' => 'Direccion incorrecta',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/shipments/' . $shipmentId);
        $response->assertOk();
        $response->assertJsonPath('data.shipment.id', $shipmentId);
        $this->assertCount(1, $response->json('data.tracking_events'));
        $this->assertCount(1, $response->json('data.pods'));
        $this->assertCount(1, $response->json('data.incidents'));
        $this->assertCount(1, $response->json('data.route_stops'));
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Shipments ' . $roleCode,
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
