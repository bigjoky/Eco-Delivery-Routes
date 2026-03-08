<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApiDocsAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_api_docs(): void
    {
        $this->get('/api-docs')->assertForbidden();
        $this->get('/openapi.yaml')->assertForbidden();
        $this->get('/openapi.json')->assertForbidden();
    }

    public function test_non_admin_user_cannot_access_api_docs(): void
    {
        $user = User::factory()->create(['status' => 'active']);
        $this->actingAs($user);

        $this->get('/api-docs')->assertForbidden();
        $this->get('/openapi.yaml')->assertForbidden();
        $this->get('/openapi.json')->assertForbidden();
    }

    public function test_super_admin_can_access_api_docs(): void
    {
        $user = User::factory()->create(['status' => 'active']);
        $roleId = (string) Str::uuid();

        DB::table('roles')->insert([
            'id' => $roleId,
            'code' => 'super_admin',
            'name' => 'Super Admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $user->id,
            'role_id' => $roleId,
        ]);

        $this->actingAs($user);

        $this->get('/api-docs')->assertOk();
        $this->get('/openapi.yaml')->assertOk();
        $this->get('/openapi.json')->assertOk();
    }
}
