# QA Checklist - UAT Ops (Shipments, Routes, Incidents)

Fecha: 2026-03-08
Ambito: Web operativa `/ops`

## 1) Envios
- [ ] Crear envio valido con remitente/destinatario completos.
- [ ] Validar errores al omitir obligatorios (documento, telefono, calle, CP, ciudad, pais).
- [ ] Alta de recogida valida y rechazo cuando falten `requester_name`, `address_line` o `scheduled_at`.
- [ ] Aplicar masivo por seleccion y confirmar `updated_count`.
- [ ] Aplicar masivo por filtros y confirmar `updated_count`.
- [ ] Ejecutar previsualizacion masiva y validar `target_count` + muestra.

## 2) Rutas
- [ ] Crear ruta con hub/fecha/codigo.
- [ ] Validar conflictos subcontrata-conductor-vehiculo.
- [ ] Agregar y eliminar paradas.
- [ ] Aplicar edicion masiva de paradas (estado + ETA).
- [ ] Aplicar desplazamiento ETA (+/- minutos) y validar cambios.

## 3) Incidencias
- [ ] Crear incidencia desde modulo incidencias.
- [ ] Resolver incidencia individual.
- [ ] Ajustar SLA individual desde modal (sin prompts).
- [ ] Resolver en lote con motivo estructurado.
- [ ] Override SLA masivo (prioridad o due_at + motivo).

## 4) Auditoria y seguridad
- [ ] Verificar evento `shipments.bulk_updated` en audit logs.
- [ ] Confirmar metadata estructurada (`changed_rows_count`, `changes` before/after).
- [ ] Validar permisos por rol: usuario sin `shipments.write` no puede crear ni actualizar masivo.

## 5) Regresion rapida
- [ ] `/login` -> `/dashboard` -> `/ops` sin errores.
- [ ] KPI Calidad carga correctamente.
- [ ] `/api-docs` accesible solo para `admin/super_admin`.
