# ADR 0010: KPI Calidad por Ruta + Expansion de Auditoria

- Date: 2026-02-27
- Status: Accepted

## Context
Se necesitaba visualizar KPI de calidad no solo por conductor, tambien por ruta. Ademas, la auditoria debia extenderse a anticipos/tarifas con actor legible y exportable.

## Decision
1. `QualityController` recalcula por `scope_type` real (`driver`, `route`, `subcontractor`) filtrando shipments/pickups/incidencias por scope.
2. `QualityController@index` devuelve `scope_label` para facilitar UX por ruta/conductor.
3. `audit-logs` enriquece resultados con:
   - `actor_name`
   - `actor_roles`
4. Se registran eventos de auditoria en `advances` y `tariffs` (create/update/approve) con IDs de recurso.
5. Web:
   - Calidad: filtro por scope, incluyendo `route`.
   - Anticipos/Tarifas: panel de timeline de auditoria por recurso.

## Consequences
- KPI de calidad operativo por ruta disponible y consultable.
- Mayor trazabilidad y legibilidad de auditoria para backoffice.
