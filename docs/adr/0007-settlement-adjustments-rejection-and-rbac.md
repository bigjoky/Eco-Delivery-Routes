# ADR 0007: Rechazo de Ajustes + RBAC Fino en Liquidaciones

- Date: 2026-02-27
- Status: Accepted

## Context
El flujo de ajustes manuales requería completar ciclo de vida con rechazo, reglas RBAC más estrictas y protección contra dobles aprobaciones.

## Decision
1. Se añade endpoint de rechazo:
   - `POST /settlements/{id}/adjustments/{adjustmentId}/reject`
2. RBAC fino por rol:
   - crear/editar ajustes: `accountant` o `super_admin`
   - aprobar/rechazar ajustes: `operations_manager` o `super_admin`
3. Guardias de concurrencia:
   - aprobación/rechazo actualizan solo si `status = pending`.
4. Web muestra desglose de importes (`gross`, `advances`, `adjustments`, `net`) y permite rechazo con motivo.

## Consequences
- Flujo completo y auditable de ajustes.
- Menor riesgo de condiciones de carrera o doble aplicación.
- Separación clara de responsabilidades entre contabilidad y gestión operativa.
