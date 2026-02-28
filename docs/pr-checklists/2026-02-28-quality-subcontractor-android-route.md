# PR Checklist - Quality Subcontractor Breakdown + Android Route KPI

## Scope
- Backend: endpoints `GET /api/v1/kpis/quality/subcontractors/{subcontractorId}/breakdown` + exportes CSV/PDF.
- Backend: tests de contrato/permisos para breakdown export y recálculo KPI.
- Web: vista `Calidad` con drill-down por subcontrata y exportes de desglose.
- Web: pantalla `Liquidacion detalle` sin `window.prompt` para rechazos (input inline con componentes UI).
- Android: nueva pantalla de detalle KPI por ruta con navegación desde `DriverRouteScreen`.

## QA Functional Cases
1. Subcontrata válida en `/kpis/quality/subcontractors/{id}/breakdown` devuelve `200` con `components` y `periods`.
2. Subcontrata inexistente devuelve `404` + `QUALITY_SUBCONTRACTOR_NOT_FOUND`.
3. Export CSV/PDF de breakdown subcontrata descarga fichero con `content-type` correcto.
4. Web: en tabla de calidad, filas `scope_type=subcontractor` muestran acción `Ver detalle subcontrata`.
5. Web: acciones `Exportar CSV/PDF subcontrata` ejecutan llamada API correcta con filtros de periodo/granularidad.
6. Web: rechazo de ajuste requiere motivo en input; no usa prompt de navegador.
7. Android: desde `Mi Ruta` se puede abrir detalle KPI de una ruta y refrescar con granularidad semanal/mensual.

## QA Contract/API
- [x] `openapi.yaml` incluye paths de breakdown/export por subcontrata.
- [x] `routes/api.php` incluye rutas nuevas de subcontrata.
- [x] `QualityByRouteHttpTest` cubre breakdown + export por subcontrata.
- [x] `RbacAccessHttpTest` cubre denegación de `quality.recalculate` y `quality.export` para driver.

## Build/Test Evidence
- [x] Backend: `./vendor/bin/phpunit --filter QualityByRouteHttpTest`
- [x] Backend: `./vendor/bin/phpunit --filter RbacAccessHttpTest`
- [x] Backend: `./vendor/bin/phpunit --filter OpsEndpointsTest`
- [x] Web: `npm test -- --run`
- [x] Web: `npm run build`
- [x] Android: `./gradlew :app:assembleDebug`
