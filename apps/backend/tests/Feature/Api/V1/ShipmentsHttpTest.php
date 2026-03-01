<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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

    public function test_rejects_scheduled_at_outside_allowed_window(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $payload = [
            'hub_id' => $hubId,
            'reference' => 'SHP-FUTURE-001',
            'consignee_name' => 'Cliente Futuro',
            'scheduled_at' => now()->addDays(365)->toDateTimeString(),
        ];

        $response = $this->postJson('/api/v1/shipments', $payload);
        $response->assertStatus(422);
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
