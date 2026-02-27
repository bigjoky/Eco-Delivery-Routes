<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PaginationHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->authenticateAsAdmin();
    }

    public function test_shipments_endpoint_returns_pagination_meta(): void
    {
        $response = $this->getJson('/api/v1/shipments?page=1&per_page=5&sort=created_at&dir=desc');
        $response->assertOk();
        $response->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total', 'last_page']]);
    }

    public function test_settlements_endpoint_returns_pagination_meta(): void
    {
        $response = $this->getJson('/api/v1/settlements?page=1&per_page=5&sort=period_start&dir=desc');
        $response->assertOk();
        $response->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total', 'last_page']]);
    }

    public function test_advances_endpoint_returns_pagination_meta(): void
    {
        $response = $this->getJson('/api/v1/advances?page=1&per_page=5&sort=request_date&dir=desc');
        $response->assertOk();
        $response->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total', 'last_page']]);
    }

    public function test_routes_endpoint_returns_pagination_meta(): void
    {
        $response = $this->getJson('/api/v1/routes?page=1&per_page=5&sort=route_date&dir=desc');
        $response->assertOk();
        $response->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total', 'last_page']]);
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
