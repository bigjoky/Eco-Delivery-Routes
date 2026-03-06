<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ContactsHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    }

    public function test_contacts_can_be_filtered_by_document_id(): void
    {
        $manager = $this->createUserWithRole('operations_manager');
        $this->actingAs($manager, 'sanctum');

        DB::table('contacts')->insert([
            'id' => (string) Str::uuid(),
            'display_name' => 'Destinatario Documento',
            'document_id' => '12345678A',
            'phone' => '+34950111222',
            'kind' => 'recipient',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('contacts')->insert([
            'id' => (string) Str::uuid(),
            'display_name' => 'Otro Contacto',
            'document_id' => 'B12345678',
            'phone' => '+34950111333',
            'kind' => 'sender',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/contacts?document_id=12345678A');
        $response
            ->assertOk()
            ->assertJsonPath('data.0.document_id', '12345678A');
        $this->assertCount(1, $response->json('data'));
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
