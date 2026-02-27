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
    }
}
