# ADR 0011: Quality Filters + Audit Before/After + Route KPI Read Model

## Estado
Aprobado - 2026-02-27

## Contexto
Se necesitaba cerrar tres huecos operativos:
1. Filtro de KPI de calidad por `hub_id` y `subcontractor_id` en backoffice.
2. Auditoria de cambios con trazabilidad de diferencias (`before/after`) en updates de anticipos y tarifas.
3. Visualizacion de KPI por ruta no solo en web, tambien en clientes nativos (lectura).

## Decision
1. Mantener `GET /kpis/quality` como endpoint unificado y usar filtros opcionales:
   - `scope_type`
   - `scope_id`
   - `hub_id`
   - `subcontractor_id`
2. En `advance.updated` y `tariff.updated`, persistir en `audit_logs.metadata`:
   - `before` (snapshot de campos relevantes previos)
   - `after` (snapshot de campos relevantes finales)
3. Reutilizar el mismo contrato `QualitySnapshot` para iOS/macOS/Android y mostrar lectura de `scope_type=route`.

## Consecuencias
- Mayor capacidad de analisis por hub/subcontrata en calidad.
- Auditoria mas fuerte para revisiones internas y reconciliacion.
- Consistencia funcional cross-platform para KPI por ruta.
