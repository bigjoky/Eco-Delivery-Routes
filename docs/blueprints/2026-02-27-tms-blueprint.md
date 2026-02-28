# Eco Delivery Routes TMS Blueprint v1

## Suposiciones explícitas
- Zona operativa inicial: **Hub Málaga** (`AGP-HUB-01`) y diseño multi-branch desde día 1.
- Autenticación API: **Laravel Sanctum** con token bearer.
- Calidad de servicio en MVP: informativa (sin impacto económico), umbral alerta `95%`.
- Liquidación/anticipos/tarifas quedan modelados en blueprint, implementación activa en MVP-3.

## 1) Modelo de dominio (implementable)
1. `hubs`: `id`, `code`, `name`, `city`, `is_active`.
2. `users`, `roles`, `permissions`, `user_roles`, `role_permissions` (RBAC).
3. `subcontractors`: `legal_name`, `tax_id`, `payment_terms`, `status`.
4. `drivers`: `employment_type(employee|subcontractor)`, `user_id?`, `subcontractor_id?`, `home_hub_id`, `code`, `status`.
5. `routes`: `hub_id`, `driver_id`, `subcontractor_id`, `code`, `route_date`, `status`.
6. `route_stops`: `route_id`, `sequence`, `stop_type(DELIVERY|PICKUP)`, `shipment_id?`, `pickup_id?`, `status`.
7. `shipments`: `hub_id`, `route_id`, `assigned_driver_id`, `subcontractor_id`, `reference`, `service_type`, `status`, `scheduled_at`, `delivered_at`.
8. `parcels`: `shipment_id`, `barcode`, `weight_grams`, `status`.
9. `pickups`: `hub_id`, `route_id`, `driver_id`, `subcontractor_id`, `reference`, `pickup_type(NORMAL|RETURN)`, `status`, `scheduled_at`, `completed_at`.
10. `tracking_events`: `trackable_type`, `trackable_id`, `event_code`, `status_to`, `scan_code`, `source`, `metadata`, `occurred_at`.
11. `pods`: `evidenceable_type(shipment|pickup)`, `evidenceable_id`, `signature_name`, `photo_url`, `geo_lat`, `geo_lng`, `captured_at`.
12. `incidents`: `incidentable_type`, `incidentable_id`, `catalog_code`, `category(failed|absent|retry|general)`, `notes`, `resolved_at`.
13. `quality_snapshots`: `scope_type(driver|subcontractor|route)`, `scope_id`, `period_start`, `period_end`, `assigned_with_attempt`, `delivered_completed`, `failed_count`, `absent_count`, `retry_count`, `pickups_completed`, `service_quality_score`, `calculation_version`, `payload`, `calculated_at`.
14. `audit_logs`: trazabilidad total de cambios/acciones críticas.
15. Blueprint futuro (MVP-3): `tariffs`, `settlements`, `settlement_lines`, `advances`, `payroll_adjustments`, `employee_kpi_targets`, `settlement_exports`.

## 2) Workflows y state machines
1. Entrega:
   - `created -> received_hub -> sorted -> loaded -> out_for_delivery -> delivered`
   - ramas no pagables: `out_for_delivery -> incident_failed|absent|retry`.
2. Recogida NORMAL:
   - `planned -> in_progress -> completed` (pagable).
3. Recogida RETURN:
   - `planned -> in_progress -> completed` (pagable, tarifa independiente).
4. Reglas pagable:
   - Pagable: `shipment.status=delivered` con `pod` válido.
   - Pagable: `pickup.status=completed` con evidencia.
   - No pagable: `retry`, `absent`, `failed`.

## 3) KPI calidad (>95%)
1. Fórmula v1:
   - `quality_score = ((delivered_completed + pickups_completed) / assigned_with_attempt) * 100`
   - Si `assigned_with_attempt = 0`, score = `0`.
2. Dimensiones:
   - `scope_type`: `driver`, `subcontractor`, `route`.
   - `period_granularity`: `monthly` (MVP), `weekly` preparado.
3. Umbral:
   - Alerta visual en dashboard si `<95.00`.
4. Reproducibilidad:
   - snapshot inmutable por ejecución con `calculation_version`, componentes y `calculated_at`.

## 4) RBAC inicial
1. `driver`: ruta, scan, POD, pickups NORMAL/RETURN, incidencias.
2. `traffic_operator`: planificación/asignación rutas y paradas, incidencias, seguimiento.
3. `warehouse_operator`: recepción/clasificación/carga y scans de hub.
4. `accountant`: calidad, liquidaciones, anticipos, ajustes, exportes.
5. `operations_manager`: operaciones end-to-end y supervisión.
6. `super_admin`: acceso total + auditoría.

## 5) API /v1 (implementado base)
1. Auth:
   - `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/refresh`.
2. Core ops:
   - `GET/POST /shipments`, `POST /shipments/{id}/deliver`
   - `GET/POST /routes`, `GET /routes/{id}/stops`
   - `GET/POST /pickups`, `POST /pickups/{id}/complete`
   - `POST /tracking-events`, `POST /pods`
   - `GET /kpis/quality`, `POST /kpis/quality/recalculate`
3. Seguridad y errores:
   - `AUTH_UNAUTHORIZED`, `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`.

## 6) UX mínimo por plataforma
1. Web Backoffice:
   - Login + listados `envíos`, `rutas`, `KPI calidad`.
2. iOS/Android Driver:
   - Login + `mi ruta` + scan + POD + pickup NORMAL/RETURN.
3. macOS Almacén:
   - recepción/scan básico + manifiesto de paradas.
4. tvOS:
   - dashboard readonly de operaciones/calidad (base ya preparada).

## 7) Roadmap
1. MVP-1 (actual en construcción): Auth/RBAC + Shipments/Parcels + Routes/Stops + Tracking + POD + Pickups + Incidents + KPI calidad básico.
2. MVP-2: almacén completo, manifiestos, conciliación, reporting avanzado.
3. MVP-3: tarifas delivery/pickup_normal/pickup_return + liquidación mensual + anticipos + ajustes + export + KPIs empleados/payroll_adjustments.
