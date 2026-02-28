# ADR 0016: Partners module MVP (subcontractors, drivers, vehicles)

- Date: 2026-02-28
- Status: Accepted

## Context
The TMS needed a dedicated operational module to manage partner resources (subcontractors, drivers, vehicles) instead of treating them as indirect references spread across quality/settlement flows.

## Decision
- Add `vehicles` table as first-class resource.
- Expose `/api/v1` endpoints:
  - `GET/POST/PATCH /subcontractors`
  - `GET/POST/PATCH /drivers`
  - `GET/POST/PATCH /vehicles`
- Authorization policy:
  - list endpoints require operational read (`routes.read`) and subcontractors list also supports settlement/quality readers for compatibility.
  - mutation endpoints require `routes.write`.
- Seed operations/staging datasets with initial vehicles.
- Add web backoffice screen `PartnersPage` to create and list subcontractors, drivers, and vehicles.
- Keep contracts documented in OpenAPI and covered by HTTP tests.

## Consequences
- Operations can manage partner entities in one module.
- API contracts are explicit and ready for mobile/macOS extension.
- Vehicle resource is now available for future route assignment/optimization logic.
