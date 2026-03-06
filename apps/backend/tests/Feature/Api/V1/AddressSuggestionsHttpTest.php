<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AddressSuggestionsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_address_suggestions_return_contacts_and_filter_by_kind(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        DB::table('contacts')->insert([
            'id' => (string) Str::uuid(),
            'display_name' => 'Destinatario Malaga',
            'kind' => 'recipient',
            'address_street' => 'Calle Larios',
            'address_number' => '12',
            'postal_code' => '29001',
            'city' => 'Malaga',
            'country' => 'ES',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('contacts')->insert([
            'id' => (string) Str::uuid(),
            'display_name' => 'Remitente Malaga',
            'kind' => 'sender',
            'address_street' => 'Calle Alameda',
            'address_number' => '7',
            'postal_code' => '29002',
            'city' => 'Malaga',
            'country' => 'ES',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/addresses/suggest?kind=recipient&q=Larios&limit=5');
        $response
            ->assertOk()
            ->assertJsonPath('data.0.address_street', 'Calle Larios')
            ->assertJsonPath('data.0.source', 'contact');
        $this->assertCount(1, $response->json('data'));
    }

    public function test_address_suggestions_include_network_points_when_matching_query(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        $hubId = (string) DB::table('hubs')->value('id');
        $depotId = (string) Str::uuid();
        DB::table('depots')->insert([
            'id' => $depotId,
            'hub_id' => $hubId,
            'code' => 'DEP-TEST-01',
            'name' => 'Depot Test',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('points')->insert([
            'id' => (string) Str::uuid(),
            'hub_id' => $hubId,
            'depot_id' => $depotId,
            'code' => 'PNT-TEST-01',
            'name' => 'Punto Centro',
            'address_line' => 'Avenida Andalucia',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/addresses/suggest?q=Andalucia&limit=10');
        $response
            ->assertOk()
            ->assertJsonFragment(['source' => 'point']);
    }

    private function createUserWithRole(string $roleCode): User
    {
        $roleId = DB::table('roles')->where('code', $roleCode)->value('id');
        $user = User::query()->create([
            'name' => ucfirst($roleCode) . ' User',
            'email' => $roleCode . '+' . Str::random(6) . '@example.test',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $user->id,
            'role_id' => $roleId,
        ]);

        return $user;
    }
}
