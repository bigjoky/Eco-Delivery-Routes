<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\Ops\AdvanceController;
use App\Http\Controllers\Api\V1\Ops\DriverRouteController;
use App\Http\Controllers\Api\V1\Ops\IncidentController;
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

        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::get('users/{id}', [UserController::class, 'show']);
        Route::patch('users/{id}', [UserController::class, 'update']);
        Route::post('users/{id}/roles', [UserController::class, 'assignRoles']);

        Route::get('roles', [RoleController::class, 'index']);
        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/export.csv', [AuditLogController::class, 'exportCsv']);

        Route::get('shipments', [ShipmentController::class, 'index']);
        Route::post('shipments', [ShipmentController::class, 'store']);
        Route::post('shipments/{id}/deliver', [ShipmentController::class, 'markDelivered']);

        Route::get('routes', [RouteController::class, 'index']);
        Route::post('routes', [RouteController::class, 'store']);
        Route::get('routes/{id}/stops', [RouteController::class, 'stops']);

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
        Route::get('incidents', [IncidentController::class, 'index']);
        Route::post('incidents', [IncidentController::class, 'store']);
        Route::patch('incidents/{id}/resolve', [IncidentController::class, 'resolve']);

        Route::get('kpis/quality', [QualityController::class, 'index']);
        Route::get('kpis/quality/top-routes-under-threshold', [QualityController::class, 'topRoutesUnderThreshold']);
        Route::get('kpis/quality/risk-summary', [QualityController::class, 'riskSummary']);
        Route::get('kpis/quality/export.csv', [QualityController::class, 'exportCsv']);
        Route::get('kpis/quality/export.pdf', [QualityController::class, 'exportPdf']);
        Route::post('kpis/quality/recalculate', [QualityController::class, 'recalculate']);
        Route::get('subcontractors', [SubcontractorController::class, 'index']);
        Route::get('settlements', [SettlementController::class, 'index']);
        Route::get('settlements/preview', [SettlementController::class, 'preview']);
        Route::post('settlements/finalize', [SettlementController::class, 'finalize']);
        Route::get('settlements/{id}', [SettlementController::class, 'show']);
        Route::get('settlements/{id}/adjustments', [SettlementAdjustmentController::class, 'index']);
        Route::post('settlements/{id}/adjustments', [SettlementAdjustmentController::class, 'store']);
        Route::patch('settlements/{id}/adjustments/{adjustmentId}', [SettlementAdjustmentController::class, 'update']);
        Route::post('settlements/{id}/adjustments/{adjustmentId}/approve', [SettlementAdjustmentController::class, 'approve']);
        Route::post('settlements/{id}/adjustments/{adjustmentId}/reject', [SettlementAdjustmentController::class, 'reject']);
        Route::post('settlements/{id}/approve', [SettlementController::class, 'approve']);
        Route::post('settlements/{id}/recalculate', [SettlementController::class, 'recalculate']);
        Route::get('settlements/{id}/export.csv', [SettlementController::class, 'exportCsv']);
        Route::get('settlements/{id}/export.pdf', [SettlementController::class, 'exportPdf']);
        Route::post('settlements/{id}/mark-paid', [SettlementController::class, 'markPaid']);
    });
});
