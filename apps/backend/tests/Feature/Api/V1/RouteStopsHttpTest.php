<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RouteStopsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_operations_manager_can_create_and_update_route_stop(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-001',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'reference' => 'SHP-STOPS-001',
            'status' => 'created',
            'service_type' => 'delivery',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $createStop = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
            'status' => 'planned',
        ]);

        $createStop->assertStatus(201);
        $stopId = (string) $createStop->json('data.id');
        $createStop->assertJsonPath('data.entity_type', 'shipment');
        $createStop->assertJsonPath('data.entity_id', $shipmentId);

        $updateStop = $this->patchJson("/api/v1/routes/{$routeId}/stops/{$stopId}", [
            'sequence' => 2,
            'status' => 'in_progress',
        ]);

        $updateStop->assertOk();
        $updateStop->assertJsonPath('data.sequence', 2);
        $updateStop->assertJsonPath('data.status', 'in_progress');

        $list = $this->getJson("/api/v1/routes/{$routeId}/stops");
        $list->assertOk();
        $this->assertCount(1, $list->json('data'));
    }

    public function test_operations_manager_can_delete_stop_and_reindex_sequences(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-DEL',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentA = (string) Str::uuid();
        $shipmentB = (string) Str::uuid();
        DB::table('shipments')->insert([
            [
                'id' => $shipmentA,
                'hub_id' => $hubId,
                'reference' => 'SHP-STOPS-DEL-A',
                'status' => 'created',
                'service_type' => 'delivery',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $shipmentB,
                'hub_id' => $hubId,
                'reference' => 'SHP-STOPS-DEL-B',
                'status' => 'created',
                'service_type' => 'delivery',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $stop1 = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentA,
        ]);
        $stop2 = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 2,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentB,
        ]);
        $stop1->assertStatus(201);
        $stop2->assertStatus(201);

        $delete = $this->deleteJson("/api/v1/routes/{$routeId}/stops/" . $stop1->json('data.id'));
        $delete->assertOk();
        $delete->assertJsonCount(1, 'data');
        $delete->assertJsonPath('data.0.sequence', 1);
        $delete->assertJsonPath('data.0.reference', 'SHP-STOPS-DEL-B');
    }

    public function test_driver_cannot_create_route_stop(): void
    {
        $driver = $this->createUserWithRole('driver');
        $this->actingAs($driver, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-DENY',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $forbidden = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'PICKUP',
        ]);

        $forbidden->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_undo_stop_creation_writes_restore_audit_event(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-UNDO',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'reference' => 'SHP-STOPS-UNDO-1',
            'status' => 'created',
            'service_type' => 'delivery',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $original = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
            'status' => 'planned',
        ]);
        $original->assertStatus(201);
        $deletedStopId = (string) $original->json('data.id');

        $this->deleteJson("/api/v1/routes/{$routeId}/stops/{$deletedStopId}")
            ->assertOk();

        $restore = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
            'status' => 'planned',
            'undo_of_stop_id' => $deletedStopId,
        ]);
        $restore->assertStatus(201);

        $undoAudit = DB::table('audit_logs')
            ->where('event', 'route.stop.undo_restored')
            ->orderByDesc('created_at')
            ->first(['metadata']);

        $this->assertNotNull($undoAudit);
        $metadata = json_decode((string) ($undoAudit->metadata ?? '{}'), true);
        $this->assertSame('route', $metadata['resource_type'] ?? null);
        $this->assertSame($routeId, $metadata['resource_id'] ?? null);
        $this->assertSame($deletedStopId, $metadata['undo_of_stop_id'] ?? null);
    }

    public function test_cannot_create_or_update_stop_with_duplicate_sequence(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-DUP',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentA = (string) Str::uuid();
        $shipmentB = (string) Str::uuid();
        DB::table('shipments')->insert([
            [
                'id' => $shipmentA,
                'hub_id' => $hubId,
                'reference' => 'SHP-STOPS-DUP-A',
                'status' => 'created',
                'service_type' => 'delivery',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $shipmentB,
                'hub_id' => $hubId,
                'reference' => 'SHP-STOPS-DUP-B',
                'status' => 'created',
                'service_type' => 'delivery',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $stopA = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentA,
        ]);
        $stopA->assertStatus(201);

        $duplicateCreate = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentB,
        ]);
        $duplicateCreate->assertStatus(422);
        $duplicateCreate->assertJsonValidationErrors(['sequence']);

        $stopB = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 2,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentB,
        ]);
        $stopB->assertStatus(201);

        $duplicateUpdate = $this->patchJson("/api/v1/routes/{$routeId}/stops/" . $stopB->json('data.id'), [
            'sequence' => 1,
        ]);
        $duplicateUpdate->assertStatus(422);
        $duplicateUpdate->assertJsonValidationErrors(['sequence']);
    }

    public function test_operations_manager_can_reorder_stops_in_single_call(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-REORDER',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentA = (string) Str::uuid();
        $shipmentB = (string) Str::uuid();
        DB::table('shipments')->insert([
            [
                'id' => $shipmentA,
                'hub_id' => $hubId,
                'reference' => 'SHP-STOPS-REORDER-A',
                'status' => 'created',
                'service_type' => 'delivery',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $shipmentB,
                'hub_id' => $hubId,
                'reference' => 'SHP-STOPS-REORDER-B',
                'status' => 'created',
                'service_type' => 'delivery',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $stopA = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentA,
        ]);
        $stopB = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 2,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentB,
        ]);
        $stopA->assertStatus(201);
        $stopB->assertStatus(201);

        $reorder = $this->postJson("/api/v1/routes/{$routeId}/stops/reorder", [
            'stop_ids' => [
                $stopB->json('data.id'),
                $stopA->json('data.id'),
            ],
        ]);

        $reorder->assertOk();
        $reorder->assertJsonPath('data.0.id', $stopB->json('data.id'));
        $reorder->assertJsonPath('data.0.sequence', 1);
        $reorder->assertJsonPath('data.1.id', $stopA->json('data.id'));
        $reorder->assertJsonPath('data.1.sequence', 2);
    }

    public function test_operations_manager_can_bulk_add_stops_and_read_manifest(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-BULK',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        $pickupId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'reference' => 'SHP-STOPS-BULK-1',
            'status' => 'created',
            'service_type' => 'delivery',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('pickups')->insert([
            'id' => $pickupId,
            'hub_id' => $hubId,
            'reference' => 'PCK-STOPS-BULK-1',
            'pickup_type' => 'NORMAL',
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $bulk = $this->postJson("/api/v1/routes/{$routeId}/stops/bulk-add", [
            'shipment_ids' => [$shipmentId],
            'pickup_ids' => [$pickupId],
            'status' => 'planned',
        ]);

        $bulk->assertOk();
        $bulk->assertJsonPath('data.created_count', 2);
        $bulk->assertJsonPath('data.skipped_existing_count', 0);

        $manifest = $this->getJson("/api/v1/routes/{$routeId}/manifest");
        $manifest->assertOk();
        $manifest->assertJsonPath('data.route.id', $routeId);
        $manifest->assertJsonPath('data.totals.stops', 2);
        $manifest->assertJsonPath('data.totals.deliveries', 1);
        $manifest->assertJsonPath('data.totals.pickups', 1);

        $csv = $this->get("/api/v1/routes/{$routeId}/manifest/export.csv");
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', (string) $csv->headers->get('content-type'));

        $pdf = $this->get("/api/v1/routes/{$routeId}/manifest/export.pdf");
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $pdf->headers->get('content-type'));

        $events = DB::table('audit_logs')
            ->orderByDesc('created_at')
            ->get(['event', 'metadata'])
            ->filter(function (object $row) use ($routeId): bool {
                $metadata = json_decode((string) ($row->metadata ?? '{}'), true);
                return ($metadata['resource_type'] ?? null) === 'route'
                    && ($metadata['resource_id'] ?? null) === $routeId;
            })
            ->pluck('event')
            ->all();
        $this->assertContains('route.stops.bulk_added', $events);
        $this->assertContains('route.manifest.exported.csv', $events);
        $this->assertContains('route.manifest.exported.pdf', $events);
    }

    public function test_operations_manager_can_update_manifest_notes(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-MANIFEST-NOTES',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $patch = $this->patchJson("/api/v1/routes/{$routeId}/manifest", [
            'manifest_notes' => 'Notas operativas de carga',
        ]);

        $patch->assertOk();
        $patch->assertJsonPath('data.route_id', $routeId);
        $patch->assertJsonPath('data.manifest_notes', 'Notas operativas de carga');

        $manifest = $this->getJson("/api/v1/routes/{$routeId}/manifest");
        $manifest->assertOk();
        $manifest->assertJsonPath('data.route.manifest_notes', 'Notas operativas de carga');
    }

    public function test_cannot_add_duplicate_shipment_stop_in_same_route(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-DUP-ENTITY',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'reference' => 'SHP-DUP-ENTITY-1',
            'status' => 'created',
            'service_type' => 'delivery',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
        ])->assertStatus(201);

        $duplicate = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 2,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
        ]);

        $duplicate->assertStatus(422);
        $duplicate->assertJsonValidationErrors(['shipment_id']);
    }

    public function test_cannot_add_stop_when_route_vehicle_capacity_is_exceeded(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $vehicleId = (string) Str::uuid();
        DB::table('vehicles')->insert([
            'id' => $vehicleId,
            'code' => 'VEH-CAP-001',
            'plate_number' => 'CAP1001',
            'vehicle_type' => 'van',
            'capacity_kg' => 1,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'vehicle_id' => $vehicleId,
            'code' => 'R-STOPS-CAP',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'reference' => 'SHP-CAP-001',
            'status' => 'created',
            'service_type' => 'delivery',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('parcels')->insert([
            'id' => (string) Str::uuid(),
            'shipment_id' => $shipmentId,
            'barcode' => 'BAR-CAP-001',
            'weight_grams' => 1500,
            'status' => 'created',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['shipment_ids']);
    }

    public function test_express_service_requires_same_day_window_on_stop_assignment(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-STOPS-EXPRESS-WINDOW',
            'route_date' => '2026-03-10',
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'reference' => 'SHP-EXPRESS-WINDOW-1',
            'status' => 'created',
            'service_type' => 'express_1030',
            'scheduled_at' => '2026-03-11T09:00:00Z',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/routes/{$routeId}/stops", [
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['shipment_id']);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Route Stops ' . $roleCode,
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
