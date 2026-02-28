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
