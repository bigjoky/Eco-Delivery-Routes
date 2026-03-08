<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\Ops\AdvanceController;
use App\Http\Controllers\Api\V1\Ops\AddressSuggestionController;
use App\Http\Controllers\Api\V1\Ops\ContactController;
use App\Http\Controllers\Api\V1\Ops\DashboardController;
use App\Http\Controllers\Api\V1\Ops\DepotController;
use App\Http\Controllers\Api\V1\Ops\DriverRouteController;
use App\Http\Controllers\Api\V1\Ops\HubController;
use App\Http\Controllers\Api\V1\Ops\IncidentController;
use App\Http\Controllers\Api\V1\Ops\PointController;
use App\Http\Controllers\Api\V1\Ops\PickupController;
use App\Http\Controllers\Api\V1\Ops\PodController;
use App\Http\Controllers\Api\V1\Ops\QualityController;
use App\Http\Controllers\Api\V1\Ops\RouteController;
use App\Http\Controllers\Api\V1\Ops\SettlementAdjustmentController;
use App\Http\Controllers\Api\V1\Ops\SettlementController;
use App\Http\Controllers\Api\V1\Ops\ShipmentController;
use App\Http\Controllers\Api\V1\Ops\SubcontractorController;
use App\Http\Controllers\Api\V1\Ops\TariffController;
use App\Http\Controllers\Api\V1\Ops\TrackingEventController;
use App\Http\Controllers\Api\V1\Ops\DriverController;
use App\Http\Controllers\Api\V1\Ops\VehicleController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login']);
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
            Route::post('refresh', [AuthController::class, 'refresh']);
        });
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('driver/me/route', [DriverRouteController::class, 'me']);
        Route::get('dashboard/overview', [DashboardController::class, 'overview']);
        Route::get('dashboard/overview/export.csv', [DashboardController::class, 'exportCsv']);
        Route::get('dashboard/overview/export.pdf', [DashboardController::class, 'exportPdf']);

        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::get('users/{id}', [UserController::class, 'show']);
        Route::patch('users/{id}', [UserController::class, 'update']);
        Route::post('users/{id}/roles', [UserController::class, 'assignRoles']);
        Route::post('users/{id}/suspend', [UserController::class, 'suspend']);
        Route::post('users/{id}/reactivate', [UserController::class, 'reactivate']);
        Route::post('users/{id}/reset-password', [UserController::class, 'resetPassword']);

        Route::get('roles', [RoleController::class, 'index']);
        Route::get('roles/{id}', [RoleController::class, 'show']);
        Route::put('roles/{id}/permissions', [RoleController::class, 'updatePermissions']);
        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/export.csv', [AuditLogController::class, 'exportCsv']);

        Route::get('shipments', [ShipmentController::class, 'index']);
        Route::get('shipments/export.csv', [ShipmentController::class, 'exportCsv'])
            ->middleware('can:shipments.export');
        Route::get('shipments/export.pdf', [ShipmentController::class, 'exportPdf'])
            ->middleware('can:shipments.export');
        Route::get('shipments/template.csv', [ShipmentController::class, 'templateCsv'])
            ->middleware('can:shipments.import');
        Route::post('shipments/import', [ShipmentController::class, 'importCsv'])
            ->middleware('can:shipments.import');
        Route::get('shipments/imports', [ShipmentController::class, 'importIndex'])
            ->middleware('can:shipments.import');
        Route::get('shipments/imports/{id}', [ShipmentController::class, 'importStatus'])
            ->middleware('can:shipments.import');
        Route::get('shipments/{id}', [ShipmentController::class, 'show']);
        Route::post('shipments', [ShipmentController::class, 'store']);
        Route::post('shipments/bulk-update', [ShipmentController::class, 'bulkUpdate']);
        Route::post('shipments/{id}/deliver', [ShipmentController::class, 'markDelivered']);
        Route::get('hubs', [HubController::class, 'index']);
        Route::post('hubs', [HubController::class, 'store']);
        Route::patch('hubs/{id}', [HubController::class, 'update']);
        Route::delete('hubs/{id}', [HubController::class, 'destroy']);
        Route::post('hubs/{id}/restore', [HubController::class, 'restore']);
        Route::get('contacts', [ContactController::class, 'index']);
        Route::get('addresses/suggest', [AddressSuggestionController::class, 'index']);
        Route::get('depots', [DepotController::class, 'index']);
        Route::post('depots', [DepotController::class, 'store']);
        Route::patch('depots/{id}', [DepotController::class, 'update']);
        Route::delete('depots/{id}', [DepotController::class, 'destroy']);
        Route::post('depots/{id}/restore', [DepotController::class, 'restore']);
        Route::get('points', [PointController::class, 'index']);
        Route::post('points', [PointController::class, 'store']);
        Route::patch('points/{id}', [PointController::class, 'update']);
        Route::delete('points/{id}', [PointController::class, 'destroy']);
        Route::post('points/{id}/restore', [PointController::class, 'restore']);

        Route::get('routes', [RouteController::class, 'index']);
        Route::get('routes/assignment/preview', [RouteController::class, 'assignmentPreview']);
        Route::get('routes/assignment/publish-policy', [RouteController::class, 'assignmentPublishPolicy']);
        Route::put('routes/assignment/publish-policy', [RouteController::class, 'upsertAssignmentPublishPolicy']);
        Route::post('routes', [RouteController::class, 'store']);
        Route::patch('routes/{id}', [RouteController::class, 'update']);
        Route::get('routes/{id}/stops', [RouteController::class, 'stops']);
        Route::post('routes/{id}/stops', [RouteController::class, 'addStop']);
        Route::post('routes/{id}/stops/bulk-add', [RouteController::class, 'bulkAddStops']);
        Route::post('routes/{id}/stops/reorder', [RouteController::class, 'reorderStops']);
        Route::patch('routes/{id}/stops/{stopId}', [RouteController::class, 'updateStop']);
        Route::delete('routes/{id}/stops/{stopId}', [RouteController::class, 'deleteStop']);
        Route::get('routes/{id}/manifest', [RouteController::class, 'manifest']);
        Route::patch('routes/{id}/manifest', [RouteController::class, 'updateManifest']);
        Route::get('routes/{id}/manifest/export.csv', [RouteController::class, 'manifestExportCsv']);
        Route::get('routes/{id}/manifest/export.pdf', [RouteController::class, 'manifestExportPdf']);

        Route::get('pickups', [PickupController::class, 'index']);
        Route::post('pickups', [PickupController::class, 'store']);
        Route::post('pickups/{id}/complete', [PickupController::class, 'complete']);

        Route::post('tracking-events', [TrackingEventController::class, 'store']);
        Route::post('pods', [PodController::class, 'store']);
        Route::get('tariffs', [TariffController::class, 'index']);
        Route::get('tariffs/current', [TariffController::class, 'current']);
        Route::post('tariffs', [TariffController::class, 'store']);
        Route::patch('tariffs/{id}', [TariffController::class, 'update']);
        Route::get('advances', [AdvanceController::class, 'index']);
        Route::get('advances/export.csv', [AdvanceController::class, 'exportCsv']);
        Route::post('advances', [AdvanceController::class, 'store']);
        Route::patch('advances/{id}', [AdvanceController::class, 'update']);
        Route::post('advances/{id}/approve', [AdvanceController::class, 'approve']);
        Route::get('incidents/catalog', [IncidentController::class, 'catalog']);
        Route::get('incidents/board', [IncidentController::class, 'board']);
        Route::get('incidents', [IncidentController::class, 'index']);
        Route::post('incidents', [IncidentController::class, 'store']);
        Route::post('incidents/resolve-bulk', [IncidentController::class, 'resolveBulk']);
        Route::patch('incidents/{id}/resolve', [IncidentController::class, 'resolve']);
        Route::patch('incidents/{id}/override-sla', [IncidentController::class, 'overrideSla']);

        Route::get('kpis/quality', [QualityController::class, 'index']);
        Route::get('kpis/quality/top-routes-under-threshold', [QualityController::class, 'topRoutesUnderThreshold']);
        Route::get('kpis/quality/risk-summary', [QualityController::class, 'riskSummary']);
        Route::get('kpis/quality/routes/{routeId}/breakdown', [QualityController::class, 'routeBreakdown']);
        Route::get('kpis/quality/routes/{routeId}/breakdown/export.csv', [QualityController::class, 'routeBreakdownExportCsv']);
        Route::get('kpis/quality/routes/{routeId}/breakdown/export.pdf', [QualityController::class, 'routeBreakdownExportPdf']);
        Route::get('kpis/quality/drivers/{driverId}/breakdown', [QualityController::class, 'driverBreakdown']);
        Route::get('kpis/quality/drivers/{driverId}/breakdown/export.csv', [QualityController::class, 'driverBreakdownExportCsv']);
        Route::get('kpis/quality/drivers/{driverId}/breakdown/export.pdf', [QualityController::class, 'driverBreakdownExportPdf']);
        Route::get('kpis/quality/subcontractors/{subcontractorId}/breakdown', [QualityController::class, 'subcontractorBreakdown']);
        Route::get('kpis/quality/subcontractors/{subcontractorId}/breakdown/export.csv', [QualityController::class, 'subcontractorBreakdownExportCsv']);
        Route::get('kpis/quality/subcontractors/{subcontractorId}/breakdown/export.pdf', [QualityController::class, 'subcontractorBreakdownExportPdf']);
        Route::get('kpis/quality/export.csv', [QualityController::class, 'exportCsv']);
        Route::get('kpis/quality/export.pdf', [QualityController::class, 'exportPdf']);
        Route::post('kpis/quality/recalculate', [QualityController::class, 'recalculate']);
        Route::get('kpis/quality/threshold', [QualityController::class, 'threshold']);
        Route::put('kpis/quality/threshold', [QualityController::class, 'upsertThreshold']);
        Route::get('kpis/quality/threshold/alert-settings', [QualityController::class, 'thresholdAlertSettings']);
        Route::put('kpis/quality/threshold/alert-settings', [QualityController::class, 'upsertThresholdAlertSettings']);
        Route::get('kpis/quality/threshold/history', [QualityController::class, 'thresholdHistory']);
        Route::get('kpis/quality/threshold/history/alerts/summary', [QualityController::class, 'thresholdHistoryAlertsSummary']);
        Route::get('kpis/quality/threshold/history/alerts/top-scopes', [QualityController::class, 'thresholdHistoryAlertsTopScopes']);
        Route::get('kpis/quality/threshold/history/export.csv', [QualityController::class, 'thresholdHistoryExportCsv']);
        Route::get('kpis/quality/threshold/history/export.pdf', [QualityController::class, 'thresholdHistoryExportPdf']);
        Route::get('subcontractors', [SubcontractorController::class, 'index']);
        Route::post('subcontractors', [SubcontractorController::class, 'store']);
        Route::patch('subcontractors/{id}', [SubcontractorController::class, 'update']);
        Route::delete('subcontractors/{id}', [SubcontractorController::class, 'destroy']);
        Route::get('drivers', [DriverController::class, 'index']);
        Route::post('drivers', [DriverController::class, 'store']);
        Route::patch('drivers/{id}', [DriverController::class, 'update']);
        Route::delete('drivers/{id}', [DriverController::class, 'destroy']);
        Route::get('vehicles', [VehicleController::class, 'index']);
        Route::post('vehicles', [VehicleController::class, 'store']);
        Route::patch('vehicles/{id}', [VehicleController::class, 'update']);
        Route::delete('vehicles/{id}', [VehicleController::class, 'destroy']);
        Route::get('settlements', [SettlementController::class, 'index']);
        Route::get('settlements/reconciliation-reasons', [SettlementController::class, 'reconciliationReasons']);
        Route::get('settlements/reconciliation-summary', [SettlementController::class, 'reconciliationSummary']);
        Route::get('settlements/reconciliation-summary/export.csv', [SettlementController::class, 'reconciliationSummaryExportCsv']);
        Route::get('settlements/reconciliation-summary/export.pdf', [SettlementController::class, 'reconciliationSummaryExportPdf']);
        Route::get('settlements/reconciliation-trends', [SettlementController::class, 'reconciliationTrends']);
        Route::get('settlements/preview', [SettlementController::class, 'preview']);
        Route::post('settlements/finalize', [SettlementController::class, 'finalize']);
        Route::get('settlements/{id}', [SettlementController::class, 'show']);
        Route::get('settlements/{id}/adjustments', [SettlementAdjustmentController::class, 'index']);
        Route::post('settlements/{id}/adjustments', [SettlementAdjustmentController::class, 'store']);
        Route::patch('settlements/{id}/adjustments/{adjustmentId}', [SettlementAdjustmentController::class, 'update']);
        Route::post('settlements/{id}/adjustments/{adjustmentId}/approve', [SettlementAdjustmentController::class, 'approve']);
        Route::post('settlements/{id}/adjustments/{adjustmentId}/reject', [SettlementAdjustmentController::class, 'reject']);
        Route::post('settlements/{id}/approve', [SettlementController::class, 'approve']);
        Route::post('settlements/{id}/preview-recalculate', [SettlementController::class, 'previewRecalculate']);
        Route::post('settlements/{id}/recalculate', [SettlementController::class, 'recalculate']);
        Route::patch('settlements/{id}/lines/{lineId}/reconcile', [SettlementController::class, 'reconcileLine']);
        Route::post('settlements/{id}/lines/reconcile-bulk/preview', [SettlementController::class, 'previewReconcileLinesBulk']);
        Route::post('settlements/{id}/lines/reconcile-bulk', [SettlementController::class, 'reconcileLinesBulk']);
        Route::get('settlements/{id}/export.csv', [SettlementController::class, 'exportCsv']);
        Route::get('settlements/{id}/export.pdf', [SettlementController::class, 'exportPdf']);
        Route::post('settlements/{id}/mark-paid', [SettlementController::class, 'markPaid']);
    });
});
