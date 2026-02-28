# ADR 0004: Anticipos CSV, RBAC HTTP y guardia de edicion de tarifas

- Date: 2026-02-27
- Status: Accepted

## Context
Era necesario cerrar operativa contable con export de anticipos, reforzar seguridad por rol y evitar cambios de tarifas que alteren periodos liquidados.

## Decision
1. Se añade `GET /api/v1/advances/export.csv` con los mismos filtros de listado.
2. Se introduce guardia de negocio en `PATCH /tariffs/{id}`:
   - bloquea edicion si la subcontrata tiene liquidaciones en estado `approved|exported|paid` que cubran la fecha efectiva de tarifa.
3. Se agregan pruebas HTTP de RBAC por rol (`driver`, `accountant`, `traffic_operator`).
4. Web de anticipos incorpora:
   - busqueda de subcontrata por texto (`q`)
   - accion de export CSV.

## Consequences
- Menor riesgo de inconsistencia financiera por cambios retroactivos de tarifas.
- Trazabilidad y validacion de permisos en endpoints críticos.
- Operativa contable más completa en backoffice.
