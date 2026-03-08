<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthNavigationFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_login_screen(): void
    {
        $response = $this->get('/login');
        $response->assertOk();
    }

    public function test_guest_is_redirected_to_login_for_dashboard_and_ops(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
        $this->get('/ops')->assertRedirect('/login');
    }

    public function test_authenticated_user_can_access_dashboard_and_ops(): void
    {
        $user = User::factory()->create([
            'status' => 'active',
        ]);

        $this->actingAs($user);

        $this->get('/dashboard')
            ->assertRedirect('/ops');

        $this->get('/ops')
            ->assertOk()
            ->assertSee('AppShellPage');
    }
}
