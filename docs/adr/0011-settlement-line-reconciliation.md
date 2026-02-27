# ADR 0011: Settlement Line Reconciliation Endpoint and UI Controls

## Status
Accepted

## Context
Settlement totals may need manual reconciliation at line level before approval/export, while preserving auditable changes and respecting RBAC.

## Decision
- Add `PATCH /api/v1/settlements/{id}/lines/{lineId}/reconcile`.
- Allow only `settlements.write` users and only when settlement status is `draft`.
- Payload supports `status` (`payable` or `excluded`) and `exclusion_reason` (required when excluded).
- Block manual reconciliation for `advance_deduction` lines.
- Recompute settlement totals immediately after each reconciliation change.
- Persist audit event `settlement.line.reconciled` with settlement/line/status metadata.
- Expose UI actions in web settlement detail with role and status guards.

## Consequences
- Accounting can reconcile payable scope without direct DB edits.
- Settlement net values remain consistent after manual exclusions/restorations.
- Every reconciliation action is traceable in audit timeline.
