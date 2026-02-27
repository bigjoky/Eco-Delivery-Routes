# PR Cierre Funcional - Envios y Rutas

Fecha de cierre: 27 de febrero de 2026

## Objetivo

Cerrar la alineacion funcional de envios/rutas entre backend, web, Android y Apple con contrato operativo unico para paradas (`entity_type`, `entity_id`, `reference`), filtros de ruta y validacion cruzada.

## Checklist de cierre

- [x] Backend: filtros y paginacion en rutas.
- [x] Backend: `driver/me/route` y `routes/{id}/stops` con contrato de paradas enriquecido.
- [x] Backend: flujo operativo validado (`tracking-events`, `pods`, `incidents`).
- [x] Web: listado y detalle de rutas, contrato de driver route tipado.
- [x] Web: test de flujo operativo mock usando contrato de entidad.
- [x] Android: fecha de ruta por defecto = hoy.
- [x] Android: parser de stops normalizado + tests unitarios.
- [x] Apple Mobile/Mac: filtros de ruta y uso de `entityType/entityId` en operaciones.
- [x] Apple SharedCore: tests de filtros y llamadas operativas.
- [x] Pipeline unificado de verificacion para release.

## Evidencia de verificacion

- `apps/backend`: `./vendor/bin/phpunit --filter 'DriverRouteHttpTest|DriverOpsFlowHttpTest|PaginationHttpTest'`
- `apps/web`: `npm test -- --run`
- `apps/android`: `./gradlew :app:testDebugUnitTest :app:assembleDebug`
- `apps/apple/SharedCore`: `swift test`

## Script unificado

- `scripts/verify_release_envios_rutas.sh`
