# PR Checklist - Envios y Rutas (Multi-app)

- [ ] Backend: contrato `driver/me/route` con `entity_type`, `entity_id`, `reference` estable.
- [ ] Backend: filtros en rutas (`status`, `date_from`, `date_to`) y paginacion (`page`, `per_page`).
- [ ] Backend: flujo operativo validado (`tracking-events`, `pods`, `incidents`).
- [ ] Web: listado de rutas con filtros y paginacion funcionando.
- [ ] Web: detalle de ruta (`/routes/:id`) mostrando paradas.
- [ ] Android: ruta del dia por defecto con fecha actual y parser de stops normalizado.
- [ ] Android: tests unitarios `ApiClientParsingTest` pasando.
- [ ] Apple Mobile: fecha de ruta por defecto con fecha actual.
- [ ] Apple Mac: scan sobre parada activa usando `entityType/entityId`.
- [ ] Apple SharedCore: tests de filtros y flujo operativo de parada pasando.

## Comandos de verificacion

- `cd apps/backend && ./vendor/bin/phpunit --filter 'DriverRouteHttpTest|DriverOpsFlowHttpTest|PaginationHttpTest'`
- `cd apps/web && npm test -- --run`
- `cd apps/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug`
- `cd apps/apple/SharedCore && swift test`
