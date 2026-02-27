export type ReconcileStatus = 'payable' | 'excluded';
export type ReconcileLineType = 'all' | 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment';
export type ReconcileCurrentStatus = 'all' | 'payable' | 'excluded';

export function hasValidCatalogReason(targetStatus: ReconcileStatus, exclusionCode: string): boolean {
  if (targetStatus === 'payable') {
    return true;
  }
  return exclusionCode.trim().length > 0;
}

export function normalizeBulkReconcileFilters(filters: {
  lineType: ReconcileLineType;
  currentStatus: ReconcileCurrentStatus;
}) {
  return {
    line_type: filters.lineType === 'all' ? undefined : filters.lineType,
    current_status: filters.currentStatus === 'all' ? undefined : filters.currentStatus,
  };
}

