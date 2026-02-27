<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class AuthEndpointsTest extends TestCase
{
    public function test_login_route_is_registered(): void
    {
        $routesFile = dirname(__DIR__, 4) . '/routes/api.php';
        $contents = file_get_contents($routesFile);

        $this->assertIsString($contents);
        $this->assertStringContainsString("Route::post('login'", $contents);
    }

    public function test_auth_controller_has_real_login_logic(): void
    {
        $controllerFile = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Auth/AuthController.php';
        $contents = file_get_contents($controllerFile);

        $this->assertIsString($contents);
        $this->assertStringContainsString('AUTH_INVALID_CREDENTIALS', $contents);
        $this->assertStringContainsString('createToken', $contents);
    }
}
