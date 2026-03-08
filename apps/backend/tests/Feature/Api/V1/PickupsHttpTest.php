<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PickupsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_creates_pickup_with_required_operational_fields(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $response = $this->postJson('/api/v1/pickups', [
            'hub_id' => $hubId,
            'pickup_type' => 'NORMAL',
            'requester_name' => 'Remitente Demo',
            'address_line' => 'Calle Pickup 10, Malaga',
            'scheduled_at' => now()->addDay()->toDateTimeString(),
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.pickup_type', 'NORMAL');
        $response->assertJsonPath('data.requester_name', 'Remitente Demo');
    }

    public function test_rejects_pickup_when_required_fields_are_missing(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $response = $this->postJson('/api/v1/pickups', [
            'hub_id' => $hubId,
            'pickup_type' => 'RETURN',
        ]);

        $response->assertStatus(422);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $user = User::query()->create([
            'name' => 'Pickups ' . $roleCode,
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
