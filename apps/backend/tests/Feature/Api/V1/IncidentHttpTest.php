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
        ]);
        $resolved->assertOk();
        $this->assertNotNull($resolved->json('data.resolved_at'));

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
