<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class UserEndpointsTest extends TestCase
{
    public function test_users_route_is_registered(): void
    {
        $routesFile = dirname(__DIR__, 4) . '/routes/api.php';
        $contents = file_get_contents($routesFile);

        $this->assertIsString($contents);
        $this->assertStringContainsString("Route::get('users'", $contents);
        $this->assertStringContainsString("Route::post('users'", $contents);
        $this->assertStringContainsString("Route::patch('users/{id}'", $contents);
        $this->assertStringContainsString("Route::post('users/{id}/roles'", $contents);
    }

    public function test_users_openapi_paths_are_present(): void
    {
        $contents = file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml');
        $this->assertIsString($contents);
        $this->assertStringContainsString('/users:', $contents);
        $this->assertStringContainsString('/users/{id}:', $contents);
        $this->assertStringContainsString('/users/{id}/roles:', $contents);
    }
}
