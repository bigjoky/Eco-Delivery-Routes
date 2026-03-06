# ADR 0020: Flujo de restauracion para nodos de red archivados

- Fecha: 2026-03-06
- Estado: Aprobado

## Contexto
Tras introducir soft-delete en hubs/depots/puntos, operacion necesitaba capacidad de restaurar nodos archivados desde backoffice.

## Decision
1. Añadir endpoints de restauracion:
- `POST /hubs/{id}/restore`
- `POST /depots/{id}/restore`
- `POST /points/{id}/restore`

2. Reglas de restauracion:
- Hub: restaurable si esta archivado.
- Depot: requiere hub padre activo.
- Point: requiere hub padre activo y depot consistente/no archivado (si aplica).

3. Web Red Operativa:
- selector para mostrar/ocultar archivados
- accion `Restaurar` en filas archivadas
- accion `Archivar` en filas activas

## Consecuencias
- Ciclo completo de vida de nodos de red sin perdida de historial.
- Menos intervencion manual en base de datos para recuperaciones operativas.
- Compatibilidad con validaciones de integridad ya existentes.
