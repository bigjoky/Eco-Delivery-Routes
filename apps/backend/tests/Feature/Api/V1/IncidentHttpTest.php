<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class IncidentHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_incidents_list_supports_filters_pagination_and_resolve_flow(): void
    {
        $shipmentCatalog = DB::table('incident_catalog_versions as versions')
            ->join('incident_catalog_items as items', 'items.version_id', '=', 'versions.id')
            ->where('versions.is_active', true)
            ->where('items.is_active', true)
            ->whereIn('items.applies_to', ['shipment', 'both'])
            ->select('items.code', 'items.category')
            ->orderBy('items.code')
            ->first();

        $this->assertNotNull($shipmentCatalog);

        $incidentableId = (string) Str::uuid();
        $created = $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => $incidentableId,
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'incident list filter test',
        ]);
        $created->assertCreated();
        $id = (string) $created->json('data.id');
        $this->assertNotSame('', $id);

        $openList = $this->getJson('/api/v1/incidents?incidentable_type=shipment&incidentable_id=' . $incidentableId . '&resolved=open&page=1&per_page=5');
        $openList->assertOk();
        $openList->assertJsonPath('meta.page', 1);
        $openList->assertJsonPath('meta.per_page', 5);
        $openList->assertJsonPath('meta.total', 1);
        $openList->assertJsonPath('data.0.id', $id);
        $openList->assertJsonPath('data.0.resolved_at', null);
        $this->assertContains($openList->json('data.0.priority'), ['high', 'medium', 'low']);
        $this->assertContains($openList->json('data.0.sla_status'), ['on_track', 'at_risk', 'breached']);

        $resolved = $this->patchJson('/api/v1/incidents/' . $id . '/resolve', [
            'notes' => 'resolved from test',
            'reason_code' => 'MANUAL_REVIEW',
            'reason_detail' => 'resuelto por operador',
        ]);
        $resolved->assertOk();
        $this->assertNotNull($resolved->json('data.resolved_at'));
        $this->assertSame('MANUAL_REVIEW', $resolved->json('data.resolution_reason_code'));
        $this->assertSame('resuelto por operador', $resolved->json('data.resolution_reason_detail'));
        $auditResolve = DB::table('audit_logs')
            ->where('event', 'incidents.resolved')
            ->latest('created_at')
            ->first();
        $this->assertNotNull($auditResolve);
        $resolveMetadata = json_decode((string) $auditResolve->metadata, true);
        $this->assertSame($id, $resolveMetadata['incident_id'] ?? null);
        $this->assertSame('MANUAL_REVIEW', $resolveMetadata['reason_code'] ?? null);

        $resolvedList = $this->getJson('/api/v1/incidents?incidentable_id=' . $incidentableId . '&resolved=resolved');
        $resolvedList->assertOk();
        $resolvedList->assertJsonPath('meta.total', 1);
        $resolvedList->assertJsonPath('data.0.id', $id);
        $resolvedList->assertJsonPath('data.0.sla_status', 'resolved');

        $board = $this->getJson('/api/v1/incidents/board?incidentable_type=shipment');
        $board->assertOk();
        $board->assertJsonStructure([
            'data' => [
                'total_open',
                'total_resolved',
                'by_priority' => ['high', 'medium', 'low'],
                'by_sla_status' => ['on_track', 'at_risk', 'breached'],
            ],
        ]);
    }

    public function test_incidents_bulk_resolve_updates_open_rows_only(): void
    {
        $shipmentCatalog = DB::table('incident_catalog_versions as versions')
            ->join('incident_catalog_items as items', 'items.version_id', '=', 'versions.id')
            ->where('versions.is_active', true)
            ->where('items.is_active', true)
            ->whereIn('items.applies_to', ['shipment', 'both'])
            ->select('items.code', 'items.category')
            ->orderBy('items.code')
            ->first();
        $this->assertNotNull($shipmentCatalog);

        $openOne = $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => (string) Str::uuid(),
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'bulk resolve open one',
        ])->assertCreated()->json('data.id');

        $openTwo = $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => (string) Str::uuid(),
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'bulk resolve open two',
        ])->assertCreated()->json('data.id');

        $this->patchJson('/api/v1/incidents/' . $openTwo . '/resolve')->assertOk();

        $response = $this->postJson('/api/v1/incidents/resolve-bulk', [
            'incident_ids' => [$openOne, $openTwo],
            'notes' => 'resolved from bulk',
            'reason_code' => 'DATA_CORRECTION',
            'reason_detail' => 'ajuste operativo',
        ]);
        $response->assertOk();
        $response->assertJsonPath('data.requested_count', 2);
        $response->assertJsonPath('data.updated_count', 1);
        $row = DB::table('incidents')->where('id', $openOne)->first();
        $this->assertSame('DATA_CORRECTION', $row->resolution_reason_code);
        $this->assertSame('ajuste operativo', $row->resolution_reason_detail);
        $auditBulk = DB::table('audit_logs')
            ->where('event', 'incidents.resolved.bulk')
            ->latest('created_at')
            ->first();
        $this->assertNotNull($auditBulk);
        $bulkMetadata = json_decode((string) $auditBulk->metadata, true);
        $this->assertSame('DATA_CORRECTION', $bulkMetadata['reason_code'] ?? null);
        $this->assertSame(2, $bulkMetadata['requested_count'] ?? null);
        $this->assertSame(1, $bulkMetadata['updated_count'] ?? null);
    }

    public function test_incidents_bulk_resolve_apply_to_filtered_works(): void
    {
        $shipmentCatalog = DB::table('incident_catalog_versions as versions')
            ->join('incident_catalog_items as items', 'items.version_id', '=', 'versions.id')
            ->where('versions.is_active', true)
            ->where('items.is_active', true)
            ->whereIn('items.applies_to', ['shipment', 'both'])
            ->select('items.code', 'items.category')
            ->orderBy('items.code')
            ->first();
        $this->assertNotNull($shipmentCatalog);

        $targetIncidentableId = (string) Str::uuid();
        $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => $targetIncidentableId,
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'bulk resolve filtered target',
        ])->assertCreated();

        $response = $this->postJson('/api/v1/incidents/resolve-bulk', [
            'apply_to_filtered' => true,
            'filters' => [
                'incidentable_type' => 'shipment',
                'incidentable_id' => $targetIncidentableId,
                'resolved' => 'open',
            ],
            'notes' => 'resolved from filtered bulk',
        ]);
        $response->assertOk();
        $response->assertJsonPath('data.requested_count', 1);
        $response->assertJsonPath('data.updated_count', 1);
    }

    public function test_incident_override_sla_single_and_bulk(): void
    {
        $shipmentCatalog = DB::table('incident_catalog_versions as versions')
            ->join('incident_catalog_items as items', 'items.version_id', '=', 'versions.id')
            ->where('versions.is_active', true)
            ->where('items.is_active', true)
            ->whereIn('items.applies_to', ['shipment', 'both'])
            ->select('items.code', 'items.category')
            ->orderBy('items.code')
            ->first();
        $this->assertNotNull($shipmentCatalog);

        $firstId = (string) $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => (string) Str::uuid(),
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'override one',
        ])->assertCreated()->json('data.id');

        $secondId = (string) $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => (string) Str::uuid(),
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'override two',
        ])->assertCreated()->json('data.id');

        $single = $this->patchJson('/api/v1/incidents/' . $firstId . '/override-sla', [
            'priority' => 'high',
            'reason' => 'single override test',
        ]);
        $single->assertOk();
        $single->assertJsonPath('data.priority_override', 'high');

        $bulk = $this->postJson('/api/v1/incidents/override-sla-bulk', [
            'incident_ids' => [$secondId],
            'priority' => 'low',
            'reason' => 'bulk override test',
        ]);
        $bulk->assertOk();
        $bulk->assertJsonPath('data.requested_count', 1);
        $bulk->assertJsonPath('data.updated_count', 1);

        $row = DB::table('incidents')->where('id', $secondId)->first();
        $this->assertSame('low', $row->priority_override);
    }

    public function test_incident_can_be_updated_from_detail_flow(): void
    {
        $shipmentCatalog = DB::table('incident_catalog_versions as versions')
            ->join('incident_catalog_items as items', 'items.version_id', '=', 'versions.id')
            ->where('versions.is_active', true)
            ->where('items.is_active', true)
            ->whereIn('items.applies_to', ['shipment', 'both'])
            ->select('items.code', 'items.category')
            ->orderBy('items.code')
            ->first();
        $this->assertNotNull($shipmentCatalog);

        $incidentId = (string) $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => (string) Str::uuid(),
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'editable incident',
        ])->assertCreated()->json('data.id');

        $updated = $this->patchJson('/api/v1/incidents/' . $incidentId, [
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'updated from shipment detail',
        ]);
        $updated->assertOk();
        $updated->assertJsonPath('data.notes', 'updated from shipment detail');

        $audit = DB::table('audit_logs')
            ->where('event', 'incidents.updated')
            ->latest('created_at')
            ->first();
        $this->assertNotNull($audit);
        $metadata = json_decode((string) $audit->metadata, true);
        $this->assertSame($incidentId, $metadata['incident_id'] ?? null);
    }

    public function test_incident_sla_recommendations_can_be_listed_and_applied(): void
    {
        $shipmentCatalog = DB::table('incident_catalog_versions as versions')
            ->join('incident_catalog_items as items', 'items.version_id', '=', 'versions.id')
            ->where('versions.is_active', true)
            ->where('items.is_active', true)
            ->whereIn('items.applies_to', ['shipment', 'both'])
            ->select('items.code', 'items.category')
            ->orderBy('items.code')
            ->first();
        $this->assertNotNull($shipmentCatalog);

        $id = (string) $this->postJson('/api/v1/incidents', [
            'incidentable_type' => 'shipment',
            'incidentable_id' => (string) Str::uuid(),
            'catalog_code' => $shipmentCatalog->code,
            'category' => $shipmentCatalog->category,
            'notes' => 'sla recommendation target',
        ])->assertCreated()->json('data.id');

        DB::table('incidents')->where('id', $id)->update([
            'created_at' => now()->subHours(10),
            'updated_at' => now()->subHours(10),
        ]);

        $recommendations = $this->getJson('/api/v1/incidents/sla-recommendations');
        $recommendations->assertOk();
        $recommendations->assertJsonStructure([
            'data' => [
                'generated_at',
                'actions' => [
                    ['key', 'label', 'description', 'estimated_count', 'recommended_payload' => ['priority', 'sla_due_at', 'reason']],
                ],
            ],
        ]);

        $apply = $this->postJson('/api/v1/incidents/sla-recommendations/breached_escalation/apply');
        $apply->assertOk();
        $apply->assertJsonPath('data.updated_count', 1);

        $updated = DB::table('incidents')->where('id', $id)->first();
        $this->assertSame('high', $updated->priority_override);
        $this->assertNotNull($updated->sla_due_at_override);

        $audit = DB::table('audit_logs')
            ->where('event', 'incidents.sla_recommendation.applied')
            ->latest('created_at')
            ->first();
        $this->assertNotNull($audit);
        $metadata = json_decode((string) $audit->metadata, true);
        $this->assertSame('breached_escalation', $metadata['recommendation_key'] ?? null);
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
