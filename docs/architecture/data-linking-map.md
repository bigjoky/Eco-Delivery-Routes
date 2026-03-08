# Data Linking Map (Ops Web)

## Objetivo

Definir el enlazado de datos entre secciones para evitar silos funcionales y garantizar navegación contextual reproducible desde auditoría y módulos operativos.

## IDs canónicos por entidad

- Shipment: `shipments.id` (UUID), referencia externa: `shipments.external_reference`.
- Route: `routes.id` (UUID), código operativo: `routes.code`.
- Incident: `incidents.id` (UUID), referencia: `incidents.reference`.
- Partner subcontrata: `subcontractors.id` (UUID), negocio: `tax_id`.
- Driver: `drivers.id` (UUID), negocio: `dni`.
- Vehicle: `vehicles.id` (UUID), negocio: `plate_number`.
- Workforce employee: `workforce_employees.id` (UUID), negocio: `document_id`.
- Vehicle control: `vehicle_controls.id` (UUID), negocio: `reference` + `event_date`.

## Relaciones funcionales

- `shipments.route_id -> routes.id`
- `route_stops.route_id -> routes.id`
- `route_stops.shipment_id -> shipments.id`
- `route_stops.pickup_id -> pickups.id`
- `incidents.incidentable_id -> shipments.id | pickups.id`
- `drivers.subcontractor_id -> subcontractors.id`
- `vehicles.subcontractor_id -> subcontractors.id`
- `vehicles.driver_id -> drivers.id`
- `workforce_employees.subcontractor_id -> subcontractors.id` (solo tipo `contractor`)
- `vehicle_controls.vehicle_id -> vehicles.id`

## Enlazado contextual UI (query params)

- Auditoría -> Partners:
  - `/partners?focus=subcontractor&id={subcontractor_id}`
  - `/partners?focus=driver&id={driver_id}`
  - `/partners?focus=vehicle&id={vehicle_id}`
- Auditoría -> Workforce:
  - `/workforce?id={employee_id}`
  - `/workforce?subcontractor_id={subcontractor_id}`
- Auditoría -> Fleet controls:
  - `/fleet-controls?vehicle_id={vehicle_id}`
  - `/fleet-controls?focus=control&id={vehicle_control_id}`
- Auditoría/Timeline -> Incidents:
  - `/incidents?incident_id={incident_id}`

## Reglas de consistencia

- Los enlaces siempre deben usar UUID técnico para filtro exacto.
- Las búsquedas de texto libre se mantienen como fallback (referencias/códigos).
- Cuando existe `focus` + `id`, la vista debe priorizar filtro exacto por `id`.
- Persistir filtros en URL para permitir compartir contexto entre operaciones y auditoría.

## Próximas extensiones

- Unificar deep links también desde tarjetas KPI del dashboard.
- Añadir breadcrumbs cruzados (`shipment -> route -> incident`) en detalles.
- Exponer grafo de relaciones en OpenAPI examples para integraciones externas.
