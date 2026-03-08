<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class DashboardOverviewEndpointTest extends TestCase
{
    public function test_dashboard_overview_route_and_docs_are_registered(): void
    {
        $routesFile = dirname(__DIR__, 4) . '/routes/api.php';
        $openApiFile = dirname(__DIR__, 4) . '/openapi.yaml';

        $routes = file_get_contents($routesFile);
        $openApi = file_get_contents($openApiFile);

        $this->assertIsString($routes);
        $this->assertIsString($openApi);
        $this->assertStringContainsString("Route::get('dashboard/overview'", $routes);
        $this->assertStringContainsString('/dashboard/overview:', $openApi);
    }

    public function test_dashboard_controller_contains_alerts_and_productivity_logic(): void
    {
        $controllerFile = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/DashboardController.php';
        $contents = file_get_contents($controllerFile);

        $this->assertIsString($contents);
        $this->assertStringContainsString('productivity_by_hub', $contents);
        $this->assertStringContainsString('productivity_by_route', $contents);
        $this->assertStringContainsString('alerts', $contents);
        $this->assertStringContainsString('quality_threshold', $contents);
        $this->assertStringContainsString('Cache::remember', $contents);
        $this->assertStringContainsString("'sla'", $contents);
    }
}
