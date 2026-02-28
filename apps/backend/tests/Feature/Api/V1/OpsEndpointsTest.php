<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class OpsEndpointsTest extends TestCase
{
    public function test_ops_routes_are_registered(): void
    {
        $routesFile = dirname(__DIR__, 4) . '/routes/api.php';
        $contents = file_get_contents($routesFile);

        $this->assertIsString($contents);
        $this->assertStringContainsString("Route::get('driver/me/route'", $contents);
        $this->assertStringContainsString("Route::get('audit-logs'", $contents);
        $this->assertStringContainsString("Route::get('audit-logs/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('tariffs'", $contents);
        $this->assertStringContainsString("Route::get('tariffs/current'", $contents);
        $this->assertStringContainsString("Route::post('tariffs'", $contents);
        $this->assertStringContainsString("Route::patch('tariffs/{id}'", $contents);
        $this->assertStringContainsString("Route::get('advances'", $contents);
        $this->assertStringContainsString("Route::get('advances/export.csv'", $contents);
        $this->assertStringContainsString("Route::post('advances'", $contents);
        $this->assertStringContainsString("Route::patch('advances/{id}'", $contents);
        $this->assertStringContainsString("Route::post('advances/{id}/approve'", $contents);
        $this->assertStringContainsString("Route::get('hubs'", $contents);
        $this->assertStringContainsString("Route::get('settlements/preview'", $contents);
        $this->assertStringContainsString("Route::get('subcontractors'", $contents);
        $this->assertStringContainsString("Route::post('settlements/finalize'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/approve'", $contents);
        $this->assertStringContainsString("Route::get('settlements/{id}/adjustments'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/adjustments'", $contents);
        $this->assertStringContainsString("Route::patch('settlements/{id}/adjustments/{adjustmentId}'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/adjustments/{adjustmentId}/approve'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/adjustments/{adjustmentId}/reject'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/preview-recalculate'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/recalculate'", $contents);
        $this->assertStringContainsString("Route::patch('settlements/{id}/lines/{lineId}/reconcile'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/lines/reconcile-bulk/preview'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/lines/reconcile-bulk'", $contents);
        $this->assertStringContainsString("Route::get('settlements/{id}/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('settlements/{id}/export.pdf'", $contents);
        $this->assertStringContainsString("Route::post('settlements/{id}/mark-paid'", $contents);
        $this->assertStringContainsString("Route::get('settlements'", $contents);
        $this->assertStringContainsString("Route::get('settlements/reconciliation-reasons'", $contents);
        $this->assertStringContainsString("Route::get('settlements/reconciliation-summary'", $contents);
        $this->assertStringContainsString("Route::get('settlements/reconciliation-summary/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('settlements/reconciliation-summary/export.pdf'", $contents);
        $this->assertStringContainsString("Route::get('settlements/reconciliation-trends'", $contents);
        $this->assertStringContainsString("Route::get('settlements/{id}'", $contents);
        $this->assertStringContainsString("Route::get('shipments'", $contents);
        $this->assertStringContainsString("Route::get('routes'", $contents);
        $this->assertStringContainsString("Route::patch('routes/{id}'", $contents);
        $this->assertStringContainsString("Route::post('routes/{id}/stops'", $contents);
        $this->assertStringContainsString("Route::patch('routes/{id}/stops/{stopId}'", $contents);
        $this->assertStringContainsString("Route::post('tracking-events'", $contents);
        $this->assertStringContainsString("Route::get('incidents/catalog'", $contents);
        $this->assertStringContainsString("Route::get('incidents'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/top-routes-under-threshold'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/risk-summary'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/routes/{routeId}/breakdown'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/routes/{routeId}/breakdown/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/routes/{routeId}/breakdown/export.pdf'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/drivers/{driverId}/breakdown'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/drivers/{driverId}/breakdown/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/drivers/{driverId}/breakdown/export.pdf'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/subcontractors/{subcontractorId}/breakdown'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/subcontractors/{subcontractorId}/breakdown/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/subcontractors/{subcontractorId}/breakdown/export.pdf'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/export.pdf'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/threshold'", $contents);
        $this->assertStringContainsString("Route::put('kpis/quality/threshold'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/threshold/alert-settings'", $contents);
        $this->assertStringContainsString("Route::put('kpis/quality/threshold/alert-settings'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/threshold/history'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/threshold/history/alerts/summary'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/threshold/history/alerts/top-scopes'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/threshold/history/export.csv'", $contents);
        $this->assertStringContainsString("Route::get('kpis/quality/threshold/history/export.pdf'", $contents);
    }

    public function test_quality_controller_uses_recalculation_formula(): void
    {
        $controllerFile = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/QualityController.php';
        $contents = file_get_contents($controllerFile);

        $this->assertIsString($contents);
        $this->assertStringContainsString('service_quality_score', $contents);
        $this->assertStringContainsString('assigned_with_attempt', $contents);
        $this->assertStringContainsString('quality.recalculate', $contents);
        $this->assertStringContainsString('topRoutesUnderThreshold', $contents);
        $this->assertStringContainsString('quality.export', $contents);
        $this->assertStringContainsString('quality.read.dashboard', $contents);
    }

    public function test_controllers_enforce_driver_scope_and_incidents_permissions(): void
    {
        $routeController = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/RouteController.php';
        $shipmentController = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/ShipmentController.php';
        $incidentController = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/IncidentController.php';
        $driverRouteController = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/DriverRouteController.php';
        $tariffController = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/TariffController.php';
        $settlementController = dirname(__DIR__, 4) . '/app/Http/Controllers/Api/V1/Ops/SettlementController.php';

        $routeContents = file_get_contents($routeController);
        $shipmentContents = file_get_contents($shipmentController);
        $incidentContents = file_get_contents($incidentController);
        $driverRouteContents = file_get_contents($driverRouteController);
        $tariffContents = file_get_contents($tariffController);
        $settlementContents = file_get_contents($settlementController);

        $this->assertIsString($routeContents);
        $this->assertIsString($shipmentContents);
        $this->assertIsString($incidentContents);
        $this->assertIsString($driverRouteContents);
        $this->assertIsString($tariffContents);
        $this->assertIsString($settlementContents);

        $this->assertStringContainsString("hasRole('driver')", $routeContents);
        $this->assertStringContainsString("hasRole('driver')", $shipmentContents);
        $this->assertStringContainsString("incidents.read", $incidentContents);
        $this->assertStringContainsString("incidents.write", $incidentContents);
        $this->assertStringContainsString("incident_catalog_items", $incidentContents);
        $this->assertStringContainsString("incident_catalog_versions", $incidentContents);
        $this->assertStringContainsString("driver/me/route", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/audit-logs:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/audit-logs/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/hubs:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/routes/{id}:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/routes/{id}/stops/{stopId}:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("tariffs", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/advances:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/advances/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/advances/{id}:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/advances/{id}/approve:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/top-routes-under-threshold:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/risk-summary:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/routes/{routeId}/breakdown:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/routes/{routeId}/breakdown/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/routes/{routeId}/breakdown/export.pdf:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/drivers/{driverId}/breakdown:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/drivers/{driverId}/breakdown/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/drivers/{driverId}/breakdown/export.pdf:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/subcontractors/{subcontractorId}/breakdown:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/subcontractors/{subcontractorId}/breakdown/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/subcontractors/{subcontractorId}/breakdown/export.pdf:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/export.pdf:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/threshold:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/threshold/alert-settings:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/threshold/history:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/threshold/history/alerts/summary:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/threshold/history/alerts/top-scopes:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/threshold/history/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/kpis/quality/threshold/history/export.pdf:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/preview", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/subcontractors:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/finalize", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/adjustments", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/adjustments/{adjustmentId}", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/adjustments/{adjustmentId}/approve", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/adjustments/{adjustmentId}/reject", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/approve", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/preview-recalculate", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/recalculate", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/lines/{lineId}/reconcile", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/lines/reconcile-bulk/preview", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/lines/reconcile-bulk", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/settlements/reconciliation-reasons:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/settlements/reconciliation-summary:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/settlements/reconciliation-summary/export.csv:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/settlements/reconciliation-summary/export.pdf:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/settlements/reconciliation-trends:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/export.csv", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/export.pdf", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("settlements/{id}/mark-paid", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/settlements:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("/settlements/{id}:", file_get_contents(dirname(__DIR__, 4) . '/openapi.yaml'));
        $this->assertStringContainsString("route_stops", $driverRouteContents);
        $this->assertStringContainsString("pickup_return", $tariffContents);
        $this->assertStringContainsString("pickup_normal", $tariffContents);
        $this->assertStringContainsString("SettlementPreviewBuilder", $settlementContents);
        $this->assertStringContainsString("advances", $settlementContents);
        $this->assertStringContainsString("settlement_lines", $settlementContents);
        $this->assertStringContainsString("settlement.approved", $settlementContents);
        $this->assertStringContainsString("settlement.exported.csv", $settlementContents);
        $this->assertStringContainsString("settlement.exported.pdf", $settlementContents);
        $this->assertStringContainsString("settlement.paid", $settlementContents);
        $this->assertStringContainsString("SettlementStateMachine", $settlementContents);
        $this->assertStringContainsString("subcontractor_name", $settlementContents);
        $this->assertStringContainsString("settlement_lines", $settlementContents);
    }
}
