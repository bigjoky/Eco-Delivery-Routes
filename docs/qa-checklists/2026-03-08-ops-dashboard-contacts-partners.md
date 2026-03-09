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
- [ ] Validar en alta de envío que se cargan listados de `hub` y `punto operativo` para usuario operativo.
- [ ] Validar mensaje de ayuda cuando no hay hubs/puntos visibles.
- [ ] Validar que con rol `super_admin` se puede crear y visualizar hubs/depots/points sin bloqueo de permisos.

## Partners (acciones masivas)

- [ ] Seleccionar subcontratas y ejecutar `bulk-status` con motivo estructurado.
- [ ] Seleccionar conductores y ejecutar `bulk-status` con motivo estructurado.
- [ ] Seleccionar vehículos y ejecutar `bulk-status` con motivo estructurado.
- [ ] Validar en auditoría que se guardan `reason_code`, `reason_detail` y `reason`.

## Incidencias (navegación cruzada)

- [ ] Desde una incidencia de tipo `shipment`, abrir `Ver envío` y validar navegación correcta.
- [ ] Desde una incidencia, usar `Ref. envío` y validar filtro en listado de envíos.
- [ ] Desde un envío, abrir `Ver incidencias` y validar filtro por `incidentable_id`.
- [ ] Validar que `Override SLA masivo` está oculto por defecto y se despliega con toggle.
- [ ] Desde detalle de envío, crear incidencia en modal y validar aparición inmediata en tabla.
- [ ] Desde detalle de envío, editar incidencia abierta en modal y validar persistencia.
- [ ] Activar `Cola SLA` y validar orden por urgencia + selección rápida de `SLA vencido`.

## Rutas (reasignación masiva)

- [ ] Seleccionar varias rutas en listado y previsualizar reasignación.
- [ ] Aplicar reasignación masiva (subcontrata/conductor/vehículo) y validar resultados.
- [ ] Probar opción `Dejar sin asignar` y validar que limpia asignaciones.
- [ ] Aplicar estado masivo (`planned/in_progress/completed`) sobre rutas seleccionadas.

## Verificaciones técnicas

- [x] `npm --prefix apps/backend run build`
- [x] `npm --prefix apps/backend run test`
- [x] `./vendor/bin/phpunit --filter=ContactsHttpTest`
- [x] `./vendor/bin/phpunit --filter=SubcontractorDriverVehicleHttpTest`
- [x] `./vendor/bin/phpunit --filter=OpsEndpointsTest`
- [ ] Validar consistencia visual de barras de acción (`ops-toolbar`) en envíos/rutas/incidencias.
- [ ] Validar responsive operativo en móvil (sidebar, topbar, tablas y KPIs).
- [ ] Validar favicon nuevo en app, PWA y API docs tras hard refresh.
