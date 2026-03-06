<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SubcontractorDriverVehicleHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_operations_manager_can_create_update_and_list_subcontractor_driver_vehicle(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $hubId = (string) DB::table('hubs')->value('id');
        $this->assertNotSame('', $hubId);

        $this->actingAs($manager, 'sanctum');

        $createSubcontractor = $this->postJson('/api/v1/subcontractors', [
            'legal_name' => 'Flota Costa del Sol SL',
            'tax_id' => 'B99887766',
            'status' => 'active',
            'payment_terms' => 'monthly',
        ]);
        $createSubcontractor->assertStatus(201);
        $subcontractorId = (string) $createSubcontractor->json('data.id');

        $createDriver = $this->postJson('/api/v1/drivers', [
            'code' => 'DRV-MOD-001',
            'name' => 'Driver Modulo Uno',
            'dni' => '12345678Z',
            'status' => 'active',
            'employment_type' => 'subcontractor',
            'subcontractor_id' => $subcontractorId,
            'home_hub_id' => $hubId,
        ]);
        $createDriver->assertStatus(201);
        $driverId = (string) $createDriver->json('data.id');

        $createVehicle = $this->postJson('/api/v1/vehicles', [
            'code' => 'VEH-MOD-001',
            'plate_number' => '0011-MOD',
            'vehicle_type' => 'van',
            'capacity_kg' => 1000,
            'status' => 'active',
            'subcontractor_id' => $subcontractorId,
            'home_hub_id' => $hubId,
            'assigned_driver_id' => $driverId,
        ]);
        $createVehicle->assertStatus(201);
        $vehicleId = (string) $createVehicle->json('data.id');

        $updateSubcontractor = $this->patchJson("/api/v1/subcontractors/{$subcontractorId}", [
            'payment_terms' => 'biweekly',
        ]);
        $updateSubcontractor->assertOk()->assertJsonPath('data.payment_terms', 'biweekly');

        $updateDriver = $this->patchJson("/api/v1/drivers/{$driverId}", [
            'status' => 'inactive',
        ]);
        $updateDriver->assertOk()->assertJsonPath('data.status', 'inactive');

        $updateVehicle = $this->patchJson("/api/v1/vehicles/{$vehicleId}", [
            'status' => 'maintenance',
        ]);
        $updateVehicle->assertOk()->assertJsonPath('data.status', 'maintenance');

        $deleteDriverConflict = $this->deleteJson("/api/v1/drivers/{$driverId}");
        $deleteDriverConflict->assertStatus(409)->assertJsonPath('error.code', 'RESOURCE_CONFLICT');

        $detachVehicleDriver = $this->patchJson("/api/v1/vehicles/{$vehicleId}", [
            'assigned_driver_id' => null,
        ]);
        $detachVehicleDriver->assertOk();

        $deleteDriver = $this->deleteJson("/api/v1/drivers/{$driverId}");
        $deleteDriver->assertOk();

        $deleteVehicle = $this->deleteJson("/api/v1/vehicles/{$vehicleId}");
        $deleteVehicle->assertOk();

        $deleteSubcontractor = $this->deleteJson("/api/v1/subcontractors/{$subcontractorId}");
        $deleteSubcontractor->assertOk();

        $drivers = $this->getJson("/api/v1/drivers?subcontractor_id={$subcontractorId}");
        $drivers->assertOk();
        $driverRow = collect($drivers->json('data'))->firstWhere('code', 'DRV-MOD-001');
        $this->assertNull($driverRow);

        $vehicles = $this->getJson("/api/v1/vehicles?subcontractor_id={$subcontractorId}");
        $vehicles->assertOk();
        $vehicleRow = collect($vehicles->json('data'))->firstWhere('code', 'VEH-MOD-001');
        $this->assertNull($vehicleRow);

        $subcontractors = $this->getJson('/api/v1/subcontractors?limit=50');
        $subcontractors->assertOk();
        $subcontractorRow = collect($subcontractors->json('data'))->firstWhere('id', $subcontractorId);
        $this->assertNull($subcontractorRow);

        $events = DB::table('audit_logs')
            ->whereIn('event', [
                'subcontractors.created',
                'subcontractors.updated',
                'subcontractors.deleted',
                'drivers.created',
                'drivers.updated',
                'drivers.deleted',
                'vehicles.created',
                'vehicles.updated',
                'vehicles.deleted',
            ])
            ->pluck('event')
            ->all();
        $this->assertContains('subcontractors.created', $events);
        $this->assertContains('subcontractors.updated', $events);
        $this->assertContains('subcontractors.deleted', $events);
        $this->assertContains('drivers.created', $events);
        $this->assertContains('drivers.updated', $events);
        $this->assertContains('drivers.deleted', $events);
        $this->assertContains('vehicles.created', $events);
        $this->assertContains('vehicles.updated', $events);
        $this->assertContains('vehicles.deleted', $events);
    }

    public function test_driver_cannot_mutate_partners_module_resources(): void
    {
        $driver = $this->createUserWithRole('driver');
        $this->actingAs($driver, 'sanctum');

        $forbiddenSubcontractor = $this->postJson('/api/v1/subcontractors', [
            'legal_name' => 'No Permitida SL',
        ]);
        $forbiddenSubcontractor->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');

        $forbiddenDriver = $this->postJson('/api/v1/drivers', [
            'code' => 'DRV-DENY-001',
            'name' => 'No Permitido',
        ]);
        $forbiddenDriver->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');

        $forbiddenVehicle = $this->postJson('/api/v1/vehicles', [
            'code' => 'VEH-DENY-001',
        ]);
        $forbiddenVehicle->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');

        $forbiddenDeleteSubcontractor = $this->deleteJson('/api/v1/subcontractors/' . Str::uuid());
        $forbiddenDeleteSubcontractor->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
        $forbiddenDeleteDriver = $this->deleteJson('/api/v1/drivers/' . Str::uuid());
        $forbiddenDeleteDriver->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
        $forbiddenDeleteVehicle = $this->deleteJson('/api/v1/vehicles/' . Str::uuid());
        $forbiddenDeleteVehicle->assertStatus(403)->assertJsonPath('error.code', 'AUTH_UNAUTHORIZED');
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Ops Module ' . $roleCode,
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
