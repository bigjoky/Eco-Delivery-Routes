# ADR 0018: Auditoria de nodos de red y autocompletado por punto en envios

- Fecha: 2026-03-06
- Estado: Aprobado

## Contexto
Se incorporo el CRUD de hubs/depots/puntos y su borrado seguro.
Faltaba trazabilidad explicita de cambios de red y una integracion operativa en el alta de envios para reducir entrada manual de direcciones.

## Decision
1. Registrar auditoria de nodos de red en backend:
- `hubs.created|updated|deleted`
- `depots.created|updated|deleted`
- `points.created|updated|deleted`

2. Añadir filtros operativos en la pantalla web de Red Operativa:
- busqueda por codigo/nombre/ciudad
- filtro por estado (activos/inactivos)
- filtro por hub para depots/puntos

3. Integrar punto operativo en alta de envios web (sin cambio de esquema):
- selector opcional de `point` dependiente del `hub`
- al elegir punto, autocompleta campos de direccion del destinatario cuando estan vacios
- añade referencia operativa en notas para trazabilidad funcional

## Consecuencias
- Mejor trazabilidad y auditabilidad de cambios de red.
- Menor friccion en data-entry de envios y menos errores de direccion.
- Mantiene compatibilidad con el contrato actual sin migraciones adicionales.
