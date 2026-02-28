<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class RoleEndpointsTest extends TestCase
{
    public function test_roles_routes_are_registered(): void
    {
        $routesFile = dirname(__DIR__, 4) . '/routes/api.php';
        $contents = file_get_contents($routesFile);

        $this->assertIsString($contents);
        $this->assertStringContainsString("Route::get('roles'", $contents);
        $this->assertStringContainsString("Route::get('roles/{id}'", $contents);
        $this->assertStringContainsString("Route::put('roles/{id}/permissions'", $contents);
    }

    public function test_roles_openapi_paths_are_present(): void
    {
        $contents = file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml');
        $this->assertIsString($contents);
        $this->assertStringContainsString('/roles:', $contents);
        $this->assertStringContainsString('/roles/{id}:', $contents);
        $this->assertStringContainsString('/roles/{id}/permissions:', $contents);
    }
}
