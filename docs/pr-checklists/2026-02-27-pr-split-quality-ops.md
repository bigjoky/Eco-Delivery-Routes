# PR Split Plan - Quality Ops Iteration

## PR 1 - Backend API (`apps/backend`)
- [ ] `GET /kpis/quality/top-routes-under-threshold` implementado y documentado.
- [ ] `GET /kpis/quality/export.csv` implementado y documentado.
- [ ] `GET /kpis/quality/export.pdf` implementado y documentado.
- [ ] Tests HTTP de calidad en verde.
- [ ] `openapi.yaml` actualizado.

## PR 2 - Web Backoffice (`apps/web`)
- [ ] Filtros combinados de calidad (`scope/hub/subcontrata/periodo`) operativos.
- [ ] Export CSV/PDF desde pantalla de calidad.
- [ ] Panel "Rutas bajo umbral" operativo.
- [ ] Timeline de auditoria con detalle expandible.
- [ ] `npm run test` y `npm run build` en verde.

## PR 3 - tvOS Dashboard (`apps/apple/EcoDeliveryRoutesTV`)
- [ ] Lectura de KPI por ruta desde API real con fallback mock.
- [ ] Polling cada 30 segundos.
- [ ] Build `xcodebuild` de tvOS en verde.
- [ ] Variables documentadas: `API_BASE_URL`, `API_TOKEN` (opcional).
