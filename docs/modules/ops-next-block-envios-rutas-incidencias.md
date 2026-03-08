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
- Plantillas rápidas separadas para `destinatario` y `remitente` desde modal (guardar/aplicar/eliminar).
- Sincronización de plantillas de contacto a backend (`POST /api/v1/contacts`) para reutilización compartida por equipo.
- Contactos compartidos recientes en modal con aplicación en 1 clic.
- Priorización por frecuencia de uso (plantillas y contactos recientes).
- Modo operador en alta de envíos: defaults persistidos de hub/operación/servicio para flujo repetitivo.
- Corregida carga de red operativa en alta: listado de hubs/puntos visible para perfiles con permisos de envíos.

2. Rutas
- Presets operativos para acciones masivas de paradas (`inicio turno`, `en curso`, `cerrar ahora`, desplazamientos ETA).
- Asignación inteligente de ruta (sugerencia automática subcontrata/conductor/vehículo válida con preview de conflictos).
- Reasignación masiva desde listado de rutas (selección múltiple + previsualización + aplicar en lote).

3. Incidencias
- Presets operativos de filtros (`SLA vencido`, `alta prioridad`, `solo pickups`).
- Preset para preparar cierre masivo estructurado por corrección de datos.
- Previsualización de impacto en cierre masivo y override SLA (volumen estimado + resumen de cambios).
- Navegación cruzada con envíos: desde incidencia a envío y desde envío a incidencias del envío.
- Override SLA masivo oculto por defecto detrás de toggle para reducir ruido visual.
- Edición rápida desde detalle de envío (catálogo/categoría/notas) + alta rápida contextual.

4. UI
- Refinado global para consistencia visual de formularios, paneles y tablas (alineación y proporciones homogéneas).
- Dashboard: eliminadas acciones rápidas y bloque SLA en una sola fila.

5. Partners
- Acciones masivas con motivo estructurado (`reason_code`, `reason_detail`, `reason`) y auditoría enriquecida.
