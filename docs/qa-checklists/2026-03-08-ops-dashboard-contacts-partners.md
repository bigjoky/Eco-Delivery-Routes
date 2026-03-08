# QA Checklist - Dashboard + Contacts + Partners Bulk Audit

Fecha: 2026-03-08
Rama: `codex/ops-next-envios-rutas-incidencias`

## Dashboard

- [ ] Abrir `/dashboard` y validar que no aparece la tarjeta "Acciones rápidas".
- [ ] Validar que el bloque "SLA incidencias" se muestra en una sola fila.
- [ ] Comprobar navegación desde cada KPI SLA a `/incidents` con filtro correcto.

## Envíos (plantillas y contactos)

- [ ] Abrir modal de destinatario y validar lista de plantillas ordenada por uso.
- [ ] Validar "Contactos compartidos recientes" y aplicar un contacto en 1 clic.
- [ ] Guardar plantilla de destinatario y comprobar sincronización en backend (`/api/v1/contacts`).
- [ ] Repetir el flujo para modal de remitente.
- [ ] Activar modo operador y validar persistencia de defaults (`hub`, `operación`, `servicio`).
- [ ] Crear envío en modo operador y validar que no se resetean los defaults de alta.
- [ ] Validar reglas de servicio:
  - [ ] `business_parcel` bloquea domingo.
  - [ ] `thermo_parcel` bloquea domingo.
- [ ] Validar dirección condicional: provincia obligatoria para `ES`, `PT`, `IT`.

## Partners (acciones masivas)

- [ ] Seleccionar subcontratas y ejecutar `bulk-status` con motivo estructurado.
- [ ] Seleccionar conductores y ejecutar `bulk-status` con motivo estructurado.
- [ ] Seleccionar vehículos y ejecutar `bulk-status` con motivo estructurado.
- [ ] Validar en auditoría que se guardan `reason_code`, `reason_detail` y `reason`.

## Verificaciones técnicas

- [x] `npm --prefix apps/backend run build`
- [x] `npm --prefix apps/backend run test`
- [x] `./vendor/bin/phpunit --filter=ContactsHttpTest`
- [x] `./vendor/bin/phpunit --filter=SubcontractorDriverVehicleHttpTest`
- [x] `./vendor/bin/phpunit --filter=OpsEndpointsTest`
