<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;
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

    public function test_can_filter_shipments_by_hub(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $secondaryHubId = (string) Str::uuid();
        DB::table('hubs')->insert([
            'id' => $secondaryHubId,
            'code' => 'AGP-HUB-SECOND',
            'name' => 'Malaga Secundario',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('shipments')->delete();
        DB::table('shipments')->insert([
            [
                'id' => (string) Str::uuid(),
                'hub_id' => $hubId,
                'reference' => 'SHP-HUB-001',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Hub 1',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'hub_id' => $secondaryHubId,
                'reference' => 'SHP-HUB-002',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Hub 2',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/v1/shipments?hub_id=' . $secondaryHubId);
        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $response->assertJsonPath('data.0.reference', 'SHP-HUB-002');
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

    public function test_can_bulk_update_shipments_status_hub_and_schedule(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $secondaryHubId = (string) Str::uuid();
        DB::table('hubs')->insert([
            'id' => $secondaryHubId,
            'code' => 'AGP-HUB-BULK',
            'name' => 'Malaga Bulk',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentA = (string) Str::uuid();
        $shipmentB = (string) Str::uuid();
        DB::table('shipments')->insert([
            [
                'id' => $shipmentA,
                'hub_id' => $hubId,
                'reference' => 'SHP-BULK-001',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Bulk 1',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $shipmentB,
                'hub_id' => $hubId,
                'reference' => 'SHP-BULK-002',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Bulk 2',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->postJson('/api/v1/shipments/bulk-update', [
            'shipment_ids' => [$shipmentA, $shipmentB],
            'status' => 'out_for_delivery',
            'hub_id' => $secondaryHubId,
            'scheduled_at' => '2026-03-10 08:00:00',
            'reason' => 'Replanificacion operativa',
        ]);

        $response->assertOk();
        $response->assertJsonPath('meta.updated_count', 2);

        $rows = DB::table('shipments')->whereIn('id', [$shipmentA, $shipmentB])->get();
        $this->assertCount(2, $rows);
        foreach ($rows as $row) {
            $this->assertSame('out_for_delivery', $row->status);
            $this->assertSame($secondaryHubId, $row->hub_id);
            $this->assertSame('2026-03-10 08:00:00', $row->scheduled_at);
        }
    }

    public function test_can_bulk_update_shipments_by_filtered_scope(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $shipmentA = (string) Str::uuid();
        $shipmentB = (string) Str::uuid();
        DB::table('shipments')->insert([
            [
                'id' => $shipmentA,
                'hub_id' => $hubId,
                'reference' => 'SHP-FILTER-001',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Filtro 1',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $shipmentB,
                'hub_id' => $hubId,
                'reference' => 'SHP-OTHER-001',
                'status' => 'created',
                'service_type' => 'delivery',
                'consignee_name' => 'Cliente Filtro 2',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->postJson('/api/v1/shipments/bulk-update', [
            'apply_to_filtered' => true,
            'filter_q' => 'FILTER-001',
            'status' => 'incident',
            'reason' => 'Bloqueo por incidencia masiva',
        ]);
        $response->assertOk();
        $response->assertJsonPath('meta.updated_count', 1);
        $response->assertJsonPath('data.0.reference', 'SHP-FILTER-001');
        $response->assertJsonPath('data.0.status', 'incident');

        $this->assertSame('incident', DB::table('shipments')->where('id', $shipmentA)->value('status'));
        $this->assertSame('created', DB::table('shipments')->where('id', $shipmentB)->value('status'));
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
            'consignee_document_id' => '12345678Z',
            'address_street' => 'Calle Mayor',
            'postal_code' => '29001',
            'city' => 'Malaga',
            'country' => 'ES',
            'consignee_phone' => '+34600111222',
            'sender_name' => 'Eco Sender',
            'sender_document_id' => '12345678A',
            'sender_address_street' => 'Calle Sender',
            'sender_postal_code' => '29001',
            'sender_city' => 'Malaga',
            'sender_country' => 'ES',
            'service_type' => 'express_1030',
            'scheduled_at' => now()->addDays(365)->toDateTimeString(),
        ];

        $response = $this->postJson('/api/v1/shipments', $payload);
        $response->assertStatus(422);
    }

    public function test_generates_reference_even_if_payload_reference_is_provided(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        DB::table('shipments')->insert([
            'id' => (string) Str::uuid(),
            'hub_id' => $hubId,
            'reference' => 'SHP-DUP-001',
            'status' => 'created',
            'service_type' => 'delivery',
            'consignee_name' => 'Cliente Duplicado',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $payload = [
            'hub_id' => $hubId,
            'reference' => 'SHP-DUP-001',
            'consignee_name' => 'Cliente Duplicado',
            'consignee_document_id' => '12345678Z',
            'address_street' => 'Calle Larios',
            'postal_code' => '29001',
            'city' => 'Malaga',
            'country' => 'ES',
            'consignee_phone' => '+34600111222',
            'sender_name' => 'Eco Sender',
            'sender_document_id' => '12345678A',
            'sender_address_street' => 'Calle Sender',
            'sender_postal_code' => '29001',
            'sender_city' => 'Malaga',
            'sender_country' => 'ES',
            'service_type' => 'express_1030',
        ];

        $response = $this->postJson('/api/v1/shipments', $payload);
        $response->assertStatus(201);
        $response->assertJsonMissing(['data' => ['reference' => 'SHP-DUP-001']]);
    }

    public function test_rejects_shipment_create_when_required_operational_fields_are_missing(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $response = $this->postJson('/api/v1/shipments', [
            'hub_id' => $hubId,
            'service_type' => 'express_1030',
        ]);

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

    public function test_can_import_shipments_csv_dry_run(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hub = DB::table('hubs')->first();
        $csv = implode("\n", [
            'hub_code,reference,consignee_name,address_line,scheduled_at,service_type',
            "{$hub->code},SHP-IMPORT-001,Cliente Uno,Calle 1,2026-03-05T08:00:00Z,delivery",
            "{$hub->code},SHP-IMPORT-002,Cliente Dos,Calle 2,2026-03-05T09:00:00Z,delivery",
        ]);
        $file = UploadedFile::fake()->createWithContent('shipments.csv', $csv);

        $response = $this->post('/api/v1/shipments/import?dry_run=1', [
            'file' => $file,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.dry_run', true);
        $this->assertSame(0, DB::table('shipments')->whereIn('reference', ['SHP-IMPORT-001', 'SHP-IMPORT-002'])->count());
    }

    public function test_can_import_shipments_csv_commit(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hub = DB::table('hubs')->first();
        $csv = implode("\n", [
            'hub_code,reference,consignee_name,address_line,scheduled_at,service_type',
            "{$hub->code},SHP-IMPORT-003,Cliente Tres,Calle 3,2026-03-05T10:00:00Z,delivery",
            "{$hub->code},SHP-IMPORT-004,Cliente Cuatro,Calle 4,2026-03-05T11:00:00Z,delivery",
        ]);
        $file = UploadedFile::fake()->createWithContent('shipments.csv', $csv);

        $response = $this->post('/api/v1/shipments/import', [
            'file' => $file,
        ]);

        $response->assertOk();
        $this->assertSame(2, DB::table('shipments')->whereIn('external_reference', ['SHP-IMPORT-003', 'SHP-IMPORT-004'])->count());
    }

    public function test_import_returns_warning_for_unknown_columns(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hub = DB::table('hubs')->first();
        $csv = implode("\n", [
            'hub_code,reference,consignee_name,address_line,scheduled_at,service_type,extra_col',
            "{$hub->code},SHP-IMPORT-005,Cliente Cinco,Calle 5,2026-03-05T12:00:00Z,delivery,VAL",
        ]);
        $file = UploadedFile::fake()->createWithContent('shipments.csv', $csv);

        $response = $this->post('/api/v1/shipments/import?dry_run=1', [
            'file' => $file,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.unknown_columns.0', 'extra_col');
    }

    public function test_can_download_template_csv(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $response = $this->get('/api/v1/shipments/template.csv');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_can_queue_async_import(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hub = DB::table('hubs')->first();
        $csv = implode("\n", [
            'hub_code,reference,consignee_name,address_line,scheduled_at,service_type',
            "{$hub->code},SHP-IMPORT-006,Cliente Seis,Calle 6,2026-03-05T13:00:00Z,delivery",
        ]);
        $file = UploadedFile::fake()->createWithContent('shipments.csv', $csv);

        $response = $this->post('/api/v1/shipments/import?async=1', [
            'file' => $file,
        ]);

        $response->assertStatus(202);
        $response->assertJsonPath('data.job_dispatched', true);
        $importId = $response->json('data.import_id');
        $this->assertNotEmpty($importId);

        $statusResponse = $this->get('/api/v1/shipments/imports/' . $importId);
        $statusResponse->assertOk();
        $statusResponse->assertJsonPath('data.id', $importId);

        $listResponse = $this->get('/api/v1/shipments/imports');
        $listResponse->assertOk();
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
