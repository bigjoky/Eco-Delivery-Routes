# QA Checklist - Cross-Module Navigation and Context Links

## Scope

- Dashboard deep links with period context.
- Audit deep links to operational pages.
- Breadcrumb consistency in operational modules.
- Technical ID visibility in core operational tables.

## Preconditions

- Authenticated admin or super_admin user.
- Seed data with shipments, routes, incidents, partners, workforce and fleet controls.

## Checks

1. Dashboard KPI links preserve period context
- Go to `/dashboard`.
- Select period `7d` or `30d`.
- Click KPI links:
  - Shipments created/out/delivered.
  - Routes planned/in_progress/completed.
  - Incidents open.
- Verify destination list opens with date filters already in URL and applied.

2. Audit links open exact entity context
- Go to `/ops/audit`.
- Search rows for `vehicle_controls.*`, `incidents.*`, `partners.*`.
- Click entity link in each row.
- Verify:
  - `vehicle_control_id` opens `/fleet-controls?focus=control&id=...`.
  - `vehicle_id` opens `/fleet-controls?vehicle_id=...`.
  - `incident_id` opens `/incidents?incident_id=...`.
  - partner/workforce links open filtered context by target ID.

3. Breadcrumb consistency
- Open `/partners`, `/workforce`, `/fleet-controls`, `/shipments/:id`, `/routes/:id`.
- Verify breadcrumb row appears at top with `Dashboard / ...`.
- Verify breadcrumb links navigate correctly.

4. Technical ID visibility
- `/shipments`: each row shows shipment `ID` plus reference.
- `/routes`: each row shows route `ID` plus code.
- `/incidents`: table includes `Incidencia ID` column.

5. Non-regression smoke
- Create and edit one partner.
- Create and edit one workforce record.
- Create and edit one fleet control.
- Confirm no runtime errors in console.

## Exit Criteria

- All checks pass without broken links, blank pages or filter mismatches.
