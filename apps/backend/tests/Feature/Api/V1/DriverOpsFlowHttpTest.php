<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DriverOpsFlowHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_driver_operational_flow_scan_pod_incident(): void
    {
        /** @var \App\Models\User|null $user */
        $user = \App\Models\User::query()->where('email', 'admin@eco.local')->first();
        $this->assertNotNull($user);

        $hubId = (string) Str::uuid();
        DB::table('hubs')->insert([
            'id' => $hubId,
            'code' => 'HUB-FLOW-' . strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 5)),
            'name' => 'Hub Flow Test',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $subcontractorId = (string) Str::uuid();
        DB::table('subcontractors')->insert([
            'id' => $subcontractorId,
            'legal_name' => 'Subcontractor Flow Test',
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
            'code' => 'DRV-FLOW-' . strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 4)),
            'name' => 'Driver Flow Test',
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
            'code' => 'R-FLOW-' . now()->format('YmdHis'),
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
            'reference' => 'SHP-FLOW-' . strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 6)),
            'service_type' => 'delivery',
            'status' => 'out_for_delivery',
            'consignee_name' => 'Flow Client',
            'address_line' => 'Calle Flow 1',
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

        $route = $this->getJson('/api/v1/driver/me/route?route_date=' . now()->toDateString());
        $route->assertOk();
        $stops = $route->json('data.stops') ?? [];
        $this->assertNotEmpty($stops);

        $target = collect($stops)->first(fn ($stop) => ($stop['entity_type'] ?? null) === 'shipment')
            ?? $stops[0];
        $entityType = (string) $target['entity_type'];
        $entityId = (string) $target['entity_id'];

        $scan = $this->postJson('/api/v1/tracking-events', [
            'trackable_type' => $entityType,
            'trackable_id' => $entityId,
            'event_code' => 'SCAN',
            'scan_code' => 'SCAN-' . substr(str_replace('-', '', $entityId), 0, 8),
            'occurred_at' => now()->toIso8601String(),
        ]);
        $scan->assertCreated();

        $pod = $this->postJson('/api/v1/pods', [
            'evidenceable_type' => $entityType,
            'evidenceable_id' => $entityId,
            'signature_name' => 'Driver Flow Test',
        ]);
        $pod->assertCreated();

        $catalog = DB::table('incident_catalog_versions as versions')
            ->join('incident_catalog_items as items', 'items.version_id', '=', 'versions.id')
            ->where('versions.is_active', true)
            ->where('items.is_active', true)
            ->whereIn('items.applies_to', ['both', $entityType])
            ->select('items.code', 'items.category')
            ->orderBy('items.code')
            ->first();
        $this->assertNotNull($catalog);

        $incident = $this->postJson('/api/v1/incidents', [
            'incidentable_type' => $entityType,
            'incidentable_id' => $entityId,
            'catalog_code' => $catalog->code,
            'category' => $catalog->category,
            'notes' => 'Flow integration test',
        ]);
        $incident->assertCreated();

        $this->assertDatabaseHas('tracking_events', [
            'trackable_type' => $entityType,
            'trackable_id' => $entityId,
            'event_code' => 'SCAN',
        ]);
        $this->assertDatabaseHas('pods', [
            'evidenceable_type' => $entityType,
            'evidenceable_id' => $entityId,
        ]);
        $this->assertDatabaseHas('incidents', [
            'incidentable_type' => $entityType,
            'incidentable_id' => $entityId,
            'catalog_code' => $catalog->code,
        ]);
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
