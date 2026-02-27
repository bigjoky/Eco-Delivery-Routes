# QA Checklist - Quality/Audit/PDF

- [x] `GET /kpis/quality` filtra por `scope_type=route`.
- [x] `GET /kpis/quality` filtra por `hub_id`.
- [x] `GET /kpis/quality` filtra por `subcontractor_id`.
- [x] `GET /settlements/{id}/export.pdf` devuelve `422` en estado `draft`.
- [x] `advance.updated` guarda `before/after` en `audit_logs.metadata`.
- [x] `tariff.updated` guarda `before/after` en `audit_logs.metadata`.
- [x] Web muestra KPI de calidad con filtros de hub/subcontrata.
- [x] Web permite filtrar calidad por rango de periodo (`period_start`, `period_end`).
- [x] Web mantiene export CSV/PDF y timeline de auditoria paginado.
- [x] Web muestra detalle expandible de `metadata` en timeline de auditoria.
- [x] iOS y macOS muestran KPI por ruta (solo lectura).
- [x] Android muestra KPI por ruta (solo lectura).
- [x] tvOS muestra bloque de KPI de calidad por ruta (solo lectura, auto-refresh).
