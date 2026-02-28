# ADR 0009: Filtros y Export de Auditoria + Controles de Timeline

- Date: 2026-02-27
- Status: Accepted

## Context
La auditoria ya estaba disponible pero faltaba capacidad operativa para acotar por fechas/eventos y exportar evidencia para revisiones y cierres.

## Decision
1. API `audit-logs` añade filtros de fecha:
   - `date_from`, `date_to`
2. Nuevo endpoint de export:
   - `GET /audit-logs/export.csv`
3. Web Settlement Detail añade controles de timeline:
   - filtro por prefijo de evento
   - rango de fechas
   - export CSV del resultado filtrado.
4. Ajustes pendientes en liquidacion mantienen edicion in-line y se combinan con la timeline auditada.

## Consequences
- Mejor trazabilidad y capacidad de reporting para auditorias internas.
- Menor friccion para revisar eventos de una liquidacion concreta.
