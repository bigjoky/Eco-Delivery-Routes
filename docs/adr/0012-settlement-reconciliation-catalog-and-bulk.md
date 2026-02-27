# ADR 0012: Catalog-Based Exclusion Reasons and Bulk Settlement Reconciliation

## Status
Accepted

## Context
Manual reconciliation required stronger consistency than free-text reasons and needed operational speed for large draft settlements.

## Decision
- Introduce `settlement_exclusion_reasons` catalog table and seed baseline reasons.
- Replace free-text exclusion input with `exclusion_code` validated against active catalog.
- Add endpoint `GET /api/v1/settlements/reconciliation-reasons`.
- Add endpoint `POST /api/v1/settlements/{id}/lines/reconcile-bulk`.
- Keep reconciliation limited to `draft` settlements and deny `advance_deduction` lines.
- Record dedicated audit events for single-line and bulk reconciliation.

## Consequences
- Reconciliation is standardized and reportable by reason code.
- Bulk operations reduce manual effort for accounting.
- Existing settlement totals and audit trail remain deterministic and reproducible.
