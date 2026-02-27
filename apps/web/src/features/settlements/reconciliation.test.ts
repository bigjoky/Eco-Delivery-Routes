import { describe, expect, it } from 'vitest';
import { hasValidCatalogReason, normalizeBulkReconcileFilters } from './reconciliation';

describe('settlement reconciliation flow helpers', () => {
  it('requires catalog reason only when target status is excluded', () => {
    expect(hasValidCatalogReason('payable', '')).toBe(true);
    expect(hasValidCatalogReason('excluded', '')).toBe(false);
    expect(hasValidCatalogReason('excluded', 'MANUAL_AUDIT')).toBe(true);
  });

  it('normalizes bulk filters removing all-values', () => {
    expect(normalizeBulkReconcileFilters({ lineType: 'all', currentStatus: 'all' })).toEqual({
      line_type: undefined,
      current_status: undefined,
    });
    expect(normalizeBulkReconcileFilters({ lineType: 'pickup_return', currentStatus: 'payable' })).toEqual({
      line_type: 'pickup_return',
      current_status: 'payable',
    });
  });
});

