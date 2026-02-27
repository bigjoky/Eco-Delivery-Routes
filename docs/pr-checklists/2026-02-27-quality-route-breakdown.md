# PR Checklist - Quality Route Breakdown

## Scope
- Backend: endpoint `GET /api/v1/kpis/quality/routes/{routeId}/breakdown`.
- Web: drill-down desde `Calidad` a desglose por ruta con componentes KPI.
- Apple macOS: panel de calidad con detalle auditable de ruta seleccionada.
- Apple tvOS: dashboard solo lectura con desglose de ruta en riesgo.

## Screenshots Required
- [ ] Web `Calidad`: tabla KPI con accion `Ver detalle ruta`.
- [ ] Web `Calidad`: bloque `Detalle KPI por ruta` con componentes.
- [ ] macOS `Calidad`: lista de rutas + panel de desglose.
- [ ] tvOS monitor: seccion `Desglose ruta en riesgo`.

## QA Functional Cases
1. `GET /kpis/quality/routes/{routeId}/breakdown` devuelve `200` y campos `components` completos.
2. `GET /kpis/quality/routes/{routeId}/breakdown` con ruta inexistente devuelve `404` + `QUALITY_ROUTE_NOT_FOUND`.
3. Filtro de periodo (`period_start`, `period_end`) afecta los totales del desglose.
4. Web: al pulsar `Ver detalle ruta`, se carga desglose de esa ruta sin recargar pagina.
5. Web: enlace `Abrir ruta` navega a `/routes/{id}`.
6. macOS: al pulsar `Detalle` en una ruta, actualiza el panel de componentes.
7. tvOS: muestra desglose de la ruta con menor score cuando hay datos API.
8. tvOS/macOS: fallback mock visible si API no responde.

## QA Contract/API
- [ ] OpenAPI incluye `/kpis/quality/routes/{routeId}/breakdown`.
- [ ] OpenAPI documenta query params `period_start` y `period_end`.
- [ ] Tests backend pasan: `QualityByRouteHttpTest`, `OpsEndpointsTest`.

## Build/Test Evidence
- [ ] Backend: `./vendor/bin/phpunit --filter QualityByRouteHttpTest`
- [ ] Backend: `./vendor/bin/phpunit --filter OpsEndpointsTest`
- [ ] Web: `npm test -- --run`
- [ ] Web: `npm run build`
- [ ] Apple SharedCore: `swift test`

