# ADR 0008: Timeline de Auditoria + Edicion In-line de Ajustes

- Date: 2026-02-27
- Status: Accepted

## Context
Se necesitaba visibilidad operativa de cambios por liquidacion y mejorar UX de ajustes sin depender de modales o prompts para editar.

## Decision
1. Endpoint de auditoria por recurso:
   - `GET /audit-logs?resource=&id=&event=&page=&per_page=`
2. Web Settlement Detail integra timeline de auditoria para `resource=settlement`.
3. Ajustes `pending` pasan a edicion in-line en tabla (guardar/cancelar).
4. Se mantiene guardia de concurrencia y se amplian pruebas HTTP para auditoria y RBAC.

## Consequences
- Mayor trazabilidad funcional durante cierres de liquidacion.
- Mejor ergonomia en backoffice para contabilidad y operaciones.
