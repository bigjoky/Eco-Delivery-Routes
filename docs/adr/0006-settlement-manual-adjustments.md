# ADR 0006: Ajustes Manuales en Liquidaciones

- Date: 2026-02-27
- Status: Accepted

## Context
Liquidaciones mensuales requieren capacidad de ajustes manuales auditables (bono/sancion/correccion) antes de aprobar y exportar.

## Decision
1. Se crea entidad `settlement_adjustments` con ciclo `pending -> approved`.
2. Endpoints nuevos:
   - `GET /settlements/{id}/adjustments`
   - `POST /settlements/{id}/adjustments`
   - `PATCH /settlements/{id}/adjustments/{adjustmentId}`
   - `POST /settlements/{id}/adjustments/{adjustmentId}/approve`
3. Al aprobar ajuste:
   - se crea linea `manual_adjustment` en `settlement_lines`
   - se recalculan `adjustments_amount_cents` y `net_amount_cents` en `settlements`
   - se registra auditoria.
4. Restriccion inicial:
   - crear/editar/aprobar ajustes solo con settlement en estado `draft`.

## Consequences
- Ajustes quedan trazables y reproducibles en el mismo ledger de liquidacion.
- Evita manipular importes fuera del flujo auditable.
