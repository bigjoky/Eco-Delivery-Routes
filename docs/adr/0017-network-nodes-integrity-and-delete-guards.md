# ADR 0017: Integridad hub/depot/punto y borrado seguro

- Fecha: 2026-03-06
- Estado: Aprobado

## Contexto
La red operativa (hubs, depots y puntos) se edita desde web y afecta planificación, envíos y rutas.
Se necesita evitar inconsistencia (punto asociado a un depot de otro hub) y evitar borrados que rompan referencias operativas.

## Decisión
1. Validar en backend la consistencia `point.hub_id` + `point.depot_id`:
- Si `depot_id` viene informado, el `hub_id` del depot debe coincidir con el `hub_id` del punto.
- Si no coincide, responder `422 VALIDATION_ERROR`.

2. Habilitar borrado seguro por API:
- `DELETE /hubs/{id}` bloquea con `409 RESOURCE_CONFLICT` si existen recursos vinculados (depots, points, routes, shipments, pickups, drivers.home_hub_id, vehicles.home_hub_id).
- `DELETE /depots/{id}` bloquea con `409 RESOURCE_CONFLICT` si existen puntos vinculados.
- `DELETE /points/{id}` permite borrado directo.

3. Exponer las reglas en OpenAPI y en web (pantalla Red Operativa) con mensajes de error de backend.

## Consecuencias
- Se evita corrupción operativa por asociaciones cruzadas hub/depot.
- Se elimina riesgo de borrados destructivos en nodos con uso activo.
- Se mantiene API REST simple y auditable para futuras extensiones (soft-delete, archivado, reasignación masiva).
