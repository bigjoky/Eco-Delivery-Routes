# ADR 0002: Web UI shadcn-style + Settlement Workflow Hardening

- Date: 2026-02-27
- Status: Accepted

## Context
Necesitamos acelerar una UI de backoffice consistente para operaciones y liquidaciones, y cerrar fiabilidad en el flujo mensual de liquidaciones con cobertura HTTP real.

## Decision
1. Web (`apps/web`) adopta una capa de componentes `shadcn-style` local en `src/components/ui` (`button`, `card`, `badge`, `input`, `select`, `table`) para migrar todas las pantallas de operaciones.
2. Se añade endpoint de busqueda rapida de subcontratas:
   - `GET /api/v1/subcontractors?q=&limit=`
   - uso principal: filtros en vistas de liquidaciones.
3. Se incorpora test HTTP real de workflow de liquidaciones:
   - `finalize -> approve -> export.csv -> mark-paid`
   - validacion de transicion invalida `draft -> mark-paid`.
4. Se corrige orden de rutas para evitar colision de `/settlements/preview` con `/settlements/{id}`.

## Consequences
- UI web más uniforme y mantenible, alineada con la petición de diseño.
- Mejor DX en filtros operativos y de contabilidad (subcontrata buscable).
- Menor riesgo de regresiones en estados de liquidacion.
