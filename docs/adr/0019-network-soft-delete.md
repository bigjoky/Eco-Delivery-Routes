# ADR 0019: Soft-delete para hubs/depots/puntos

- Fecha: 2026-03-06
- Estado: Aprobado

## Contexto
El borrado de nodos de red debe ser reversible a nivel de datos y mantener trazabilidad historica.
El borrado fisico elimina contexto operativo/auditoria para analisis posteriores.

## Decision
1. Introducir `deleted_at` en tablas `hubs`, `depots`, `points`.
2. Reinterpretar DELETE como archivado:
- `DELETE /hubs/{id}`: marca `deleted_at`.
- `DELETE /depots/{id}`: marca `deleted_at`.
- `DELETE /points/{id}`: marca `deleted_at`.
3. Excluir archivados por defecto en listados (`whereNull(deleted_at)`), con `include_deleted=true` opcional en GET.
4. Mantener reglas de conflicto actuales antes de archivar.

## Consecuencias
- Se conserva historial operativo y consistencia referencial.
- El contrato cliente no cambia (sigue recibiendo `deleted: true`).
- Se abre la puerta a futura restauracion/undelete sin rehacer registros.
