<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class NetworkNodesHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_point_requires_depot_from_same_hub(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubA = (string) DB::table('hubs')->value('id');
        $hubB = (string) Str::uuid();
        DB::table('hubs')->insert([
            'id' => $hubB,
            'code' => 'HUB-TEST-002',
            'name' => 'Hub Test 2',
            'city' => 'Sevilla',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $createDepot = $this->postJson('/api/v1/depots', [
            'hub_id' => $hubA,
            'name' => 'Depot Test A',
        ]);
        $createDepot->assertStatus(201);
        $depotId = (string) $createDepot->json('data.id');

        $mismatchPoint = $this->postJson('/api/v1/points', [
            'hub_id' => $hubB,
            'depot_id' => $depotId,
            'name' => 'Punto Inconsistente',
        ]);

        $mismatchPoint
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_hub_delete_is_blocked_when_linked_resources_exist_and_allowed_when_empty(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $seedHubId = (string) DB::table('hubs')->value('id');
        $blocked = $this->deleteJson('/api/v1/hubs/' . $seedHubId);
        $blocked
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'RESOURCE_CONFLICT');

        $createHub = $this->postJson('/api/v1/hubs', [
            'name' => 'Hub Borrable',
            'city' => 'Cordoba',
        ]);
        $createHub->assertStatus(201);
        $hubId = (string) $createHub->json('data.id');

        $deleted = $this->deleteJson('/api/v1/hubs/' . $hubId);
        $deleted
            ->assertOk()
            ->assertJsonPath('data.deleted', true);
        $this->assertNotNull(DB::table('hubs')->where('id', $hubId)->value('deleted_at'));

        $events = DB::table('audit_logs')
            ->whereIn('event', ['hubs.created', 'hubs.deleted'])
            ->pluck('event')
            ->all();
        $this->assertContains('hubs.created', $events);
        $this->assertContains('hubs.deleted', $events);
    }

    public function test_depot_delete_is_blocked_with_points_and_point_can_be_deleted(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');

        $createDepot = $this->postJson('/api/v1/depots', [
            'hub_id' => $hubId,
            'name' => 'Depot Delete Test',
        ]);
        $createDepot->assertStatus(201);
        $depotId = (string) $createDepot->json('data.id');

        $createPoint = $this->postJson('/api/v1/points', [
            'hub_id' => $hubId,
            'depot_id' => $depotId,
            'name' => 'Point Delete Test',
        ]);
        $createPoint->assertStatus(201);
        $pointId = (string) $createPoint->json('data.id');

        $blockedDepotDelete = $this->deleteJson('/api/v1/depots/' . $depotId);
        $blockedDepotDelete
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'RESOURCE_CONFLICT');

        $pointDeleted = $this->deleteJson('/api/v1/points/' . $pointId);
        $pointDeleted
            ->assertOk()
            ->assertJsonPath('data.deleted', true);
        $this->assertNotNull(DB::table('points')->where('id', $pointId)->value('deleted_at'));

        $depotDeleted = $this->deleteJson('/api/v1/depots/' . $depotId);
        $depotDeleted
            ->assertOk()
            ->assertJsonPath('data.deleted', true);
        $this->assertNotNull(DB::table('depots')->where('id', $depotId)->value('deleted_at'));

        $events = DB::table('audit_logs')
            ->whereIn('event', ['depots.created', 'depots.deleted', 'points.created', 'points.deleted'])
            ->pluck('event')
            ->all();
        $this->assertContains('depots.created', $events);
        $this->assertContains('depots.deleted', $events);
        $this->assertContains('points.created', $events);
        $this->assertContains('points.deleted', $events);
    }

    public function test_network_nodes_can_be_restored_with_parent_dependencies(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubCreate = $this->postJson('/api/v1/hubs', [
            'name' => 'Hub Restore Test',
            'city' => 'Malaga',
        ]);
        $hubCreate->assertStatus(201);
        $hubId = (string) $hubCreate->json('data.id');

        $depotCreate = $this->postJson('/api/v1/depots', [
            'hub_id' => $hubId,
            'name' => 'Depot Restore Test',
        ]);
        $depotCreate->assertStatus(201);
        $depotId = (string) $depotCreate->json('data.id');

        $pointCreate = $this->postJson('/api/v1/points', [
            'hub_id' => $hubId,
            'depot_id' => $depotId,
            'name' => 'Point Restore Test',
        ]);
        $pointCreate->assertStatus(201);
        $pointId = (string) $pointCreate->json('data.id');

        $this->deleteJson('/api/v1/points/' . $pointId)->assertOk();
        $this->deleteJson('/api/v1/depots/' . $depotId)->assertOk();
        $this->deleteJson('/api/v1/hubs/' . $hubId)->assertOk();

        $restoreDepotWhileHubArchived = $this->postJson('/api/v1/depots/' . $depotId . '/restore');
        $restoreDepotWhileHubArchived
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'RESOURCE_CONFLICT');

        $this->postJson('/api/v1/hubs/' . $hubId . '/restore')->assertOk();
        $this->postJson('/api/v1/depots/' . $depotId . '/restore')->assertOk();
        $this->postJson('/api/v1/points/' . $pointId . '/restore')->assertOk();

        $this->assertNull(DB::table('hubs')->where('id', $hubId)->value('deleted_at'));
        $this->assertNull(DB::table('depots')->where('id', $depotId)->value('deleted_at'));
        $this->assertNull(DB::table('points')->where('id', $pointId)->value('deleted_at'));

        $events = DB::table('audit_logs')
            ->whereIn('event', ['hubs.restored', 'depots.restored', 'points.restored'])
            ->pluck('event')
            ->all();
        $this->assertContains('hubs.restored', $events);
        $this->assertContains('depots.restored', $events);
        $this->assertContains('points.restored', $events);
    }

    public function test_depot_cannot_be_created_under_archived_hub(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubCreate = $this->postJson('/api/v1/hubs', [
            'name' => 'Hub Archived Parent',
            'city' => 'Malaga',
        ]);
        $hubCreate->assertStatus(201);
        $hubId = (string) $hubCreate->json('data.id');

        $this->deleteJson('/api/v1/hubs/' . $hubId)->assertOk();

        $createDepot = $this->postJson('/api/v1/depots', [
            'hub_id' => $hubId,
            'name' => 'Depot Invalid Parent',
        ]);

        $createDepot
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Network ' . $roleCode,
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
