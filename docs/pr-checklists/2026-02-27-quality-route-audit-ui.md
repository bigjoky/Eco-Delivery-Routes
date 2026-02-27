# PR Checklist - Quality Route + Audit UI + TV Dashboard

- [ ] Web: filtros de calidad combinados (`scope_type`, `hub_id`, `subcontractor_id`, `period_start`, `period_end`) validados.
- [ ] Web: timeline de auditoria con detalle expandible de `metadata` en liquidaciones/anticipos/tarifas.
- [ ] Backend: auditoria `before/after` para `advance.updated` y `tariff.updated`.
- [ ] Backend: `export.pdf` de liquidacion bloqueado en `draft` con `422`.
- [ ] Android: pantalla driver muestra KPI por ruta en modo lectura y compila `assembleDebug`.
- [ ] iOS/macOS: KPI por ruta visible y builds en simulador/macOS correctas.
- [ ] tvOS: dashboard incluye bloque de calidad por ruta y refresco periodico.
- [ ] Tests backend y web ejecutados en verde.
- [ ] OpenAPI actualizado para cambios funcionales.
