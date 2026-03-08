# Ops Next Block - Envios, Rutas e Incidencias

## Rama

- `codex/ops-next-envios-rutas-incidencias`

## Objetivo

- Cerrar huecos operativos de alta frecuencia en:
  - alta/edición de envíos,
  - planificación/ejecución de rutas,
  - gestión y cierre de incidencias.

## Entregables del bloque

1. Envíos
- Validación previa obligatoria homogénea en create/edit (UI + API errors).
- Flujo de alta rápida optimizado (menos pasos para casos estándar).
- Plantillas de envío con aplicación y edición desde listado.

2. Rutas
- Edición masiva estable de paradas (estado/ETA/secuencia) con previsualización.
- Acciones rápidas para planificación diaria por hub/subcontrata.
- Mejor trazabilidad de cambios de asignación (driver/vehículo/subcontrata).

3. Incidencias
- Cierre masivo con motivo estructurado y detalle opcional.
- Mejor filtrado por SLA/prioridad/catálogo con presets.
- Vista de actividad focalizada por incidencia seleccionada.

## Criterios técnicos

- Backend: endpoints `/api/v1` consistentes + tests feature.
- Web: no inline styles nuevos; usar sistema de estilos global.
- Auditoría: siempre bajo demanda (no visible por defecto).
- QA: checklist funcional de regresión por módulo.

## Secuencia sugerida

1. Envíos: validaciones y alta rápida.
2. Rutas: edición masiva + planificación.
3. Incidencias: cierre masivo + filtros SLA.
4. QA integral + documentación + PR.

## Iteración aplicada (actual)

1. Envíos
- Checklist de validación previa visible antes de crear.
- Botón `Crear envío/recogida` bloqueado hasta cumplir validaciones mínimas.

2. Rutas
- Presets operativos para acciones masivas de paradas (`inicio turno`, `en curso`, `cerrar ahora`, desplazamientos ETA).

3. Incidencias
- Presets operativos de filtros (`SLA vencido`, `alta prioridad`, `solo pickups`).
- Preset para preparar cierre masivo estructurado por corrección de datos.
