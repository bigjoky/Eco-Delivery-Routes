# Settlement Reconciliation QA Checklist

## Scope
- Settlement detail line reconciliation (`Excluir` / `Reincluir`).
- Catalog-based exclusion reasons.
- Bulk reconciliation by filters.
- Audit timeline traceability.

## Preconditions
- User role: `accountant` or `super_admin`.
- Settlement in `draft` status with at least:
  - one `shipment_delivery` line
  - one `pickup_normal` line
- Reconciliation reasons catalog available from `/api/v1/settlements/reconciliation-reasons`.

## Test Cases
1. Single-line exclusion with catalog reason:
   - Select reason code.
   - Click `Excluir` on payable line.
   - Verify line status becomes `excluded`.
   - Verify settlement gross/net are recomputed.
   - Verify audit event `settlement.line.reconciled`.
2. Single-line restore:
   - Click `Reincluir` on excluded line.
   - Verify line status returns to `payable`.
   - Verify totals are recomputed.
3. Bulk exclusion by filter:
   - Filter line type `pickup_normal`, current status `payable`, target `excluded`.
   - Execute `Conciliar en lote`.
   - Verify affected count > 0 and only matching lines change.
   - Verify audit event `settlement.lines.bulk_reconciled`.
4. Bulk restore:
   - Filter current status `excluded`, target `payable`.
   - Execute bulk reconcile and verify totals update.
5. Role restriction:
   - Login as `driver`.
   - Verify reconciliation actions are blocked and API returns `403`.
6. Status restriction:
   - Move settlement to `approved`.
   - Verify both single/bulk reconciliation are rejected with `422`.

## Expected API Errors
- `AUTH_UNAUTHORIZED` for missing permission.
- `VALIDATION_ERROR` for invalid state or invalid exclusion code.
- `RESOURCE_NOT_FOUND` for missing settlement/line.
