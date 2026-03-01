<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RouteVehicleAssignmentHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_operations_manager_can_create_and_update_route_vehicle_assignment(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $this->assertNotSame('', $hubId);

        $subcontractorId = (string) Str::uuid();
        DB::table('subcontractors')->insert([
            'id' => $subcontractorId,
            'legal_name' => 'Route Assign Demo SL',
            'tax_id' => 'B12345678',
            'status' => 'active',
            'payment_terms' => 'monthly',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $driverA = (string) Str::uuid();
        DB::table('drivers')->insert([
            'id' => $driverA,
            'subcontractor_id' => $subcontractorId,
            'employment_type' => 'subcontractor',
            'code' => 'DRV-RT-001',
            'name' => 'Driver Route 001',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $vehicleA = (string) Str::uuid();
        DB::table('vehicles')->insert([
            'id' => $vehicleA,
            'subcontractor_id' => $subcontractorId,
            'assigned_driver_id' => $driverA,
            'code' => 'VEH-RT-001',
            'plate_number' => 'RT1001',
            'vehicle_type' => 'van',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $create = $this->postJson('/api/v1/routes', [
            'hub_id' => $hubId,
            'code' => 'R-VEH-ASSIGN-001',
            'route_date' => now()->toDateString(),
            'subcontractor_id' => $subcontractorId,
            'driver_id' => $driverA,
            'vehicle_id' => $vehicleA,
        ]);

        $create->assertStatus(201);
        $routeId = (string) $create->json('data.id');
        $create->assertJsonPath('data.driver_id', $driverA);
        $create->assertJsonPath('data.driver_code', 'DRV-RT-001');
        $create->assertJsonPath('data.vehicle_id', $vehicleA);
        $create->assertJsonPath('data.vehicle_code', 'RT1001');

        $driverB = (string) Str::uuid();
        DB::table('drivers')->insert([
            'id' => $driverB,
            'subcontractor_id' => $subcontractorId,
            'employment_type' => 'subcontractor',
            'code' => 'DRV-RT-002',
            'name' => 'Driver Route 002',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $vehicleB = (string) Str::uuid();
        DB::table('vehicles')->insert([
            'id' => $vehicleB,
            'subcontractor_id' => $subcontractorId,
            'assigned_driver_id' => $driverB,
            'code' => 'VEH-RT-002',
            'plate_number' => 'RT1002',
            'vehicle_type' => 'van',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $update = $this->patchJson("/api/v1/routes/{$routeId}", [
            'driver_id' => $driverB,
            'vehicle_id' => $vehicleB,
            'status' => 'in_progress',
        ]);

        $update->assertOk();
        $update->assertJsonPath('data.driver_id', $driverB);
        $update->assertJsonPath('data.driver_code', 'DRV-RT-002');
        $update->assertJsonPath('data.vehicle_id', $vehicleB);
        $update->assertJsonPath('data.vehicle_code', 'RT1002');
        $update->assertJsonPath('data.status', 'in_progress');

        $list = $this->getJson('/api/v1/routes?sort=route_date&dir=desc');
        $list->assertOk();
        $matched = collect($list->json('data'))->firstWhere('id', $routeId);
        $this->assertNotNull($matched);
        $this->assertSame('DRV-RT-002', $matched['driver_code']);
        $this->assertSame('RT1002', $matched['vehicle_code']);
    }

    public function test_driver_cannot_update_route_vehicle_assignment(): void
    {
        $driver = $this->createUserWithRole('driver');
        $this->actingAs($driver, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-VEH-ASSIGN-DENY',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $forbidden = $this->patchJson("/api/v1/routes/{$routeId}", [
            'vehicle_id' => (string) Str::uuid(),
        ]);

        $forbidden->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    public function test_update_route_rejects_vehicle_assigned_to_different_driver(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $subcontractorId = (string) Str::uuid();
        DB::table('subcontractors')->insert([
            'id' => $subcontractorId,
            'legal_name' => 'Mismatch Demo SL',
            'status' => 'active',
            'payment_terms' => 'monthly',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $driverA = (string) Str::uuid();
        $driverB = (string) Str::uuid();
        DB::table('drivers')->insert([
            [
                'id' => $driverA,
                'subcontractor_id' => $subcontractorId,
                'employment_type' => 'subcontractor',
                'code' => 'DRV-MIS-001',
                'name' => 'Driver Mis 1',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $driverB,
                'subcontractor_id' => $subcontractorId,
                'employment_type' => 'subcontractor',
                'code' => 'DRV-MIS-002',
                'name' => 'Driver Mis 2',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $vehicle = (string) Str::uuid();
        DB::table('vehicles')->insert([
            'id' => $vehicle,
            'subcontractor_id' => $subcontractorId,
            'assigned_driver_id' => $driverA,
            'code' => 'VEH-MIS-001',
            'vehicle_type' => 'van',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $routeId = (string) Str::uuid();
        DB::table('routes')->insert([
            'id' => $routeId,
            'hub_id' => $hubId,
            'code' => 'R-MIS-001',
            'route_date' => now()->toDateString(),
            'status' => 'planned',
            'subcontractor_id' => $subcontractorId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->patchJson("/api/v1/routes/{$routeId}", [
            'driver_id' => $driverB,
            'vehicle_id' => $vehicle,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['vehicle_id']);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Route Vehicle ' . $roleCode,
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
