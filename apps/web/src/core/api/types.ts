export type UserSummary = {
  id: string;
  name: string;
  email: string;
  status: string;
};

export type PaginationMeta = {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type RoleSummary = {
  id: string;
  code: string;
  name: string;
};

export type ShipmentSummary = {
  id: string;
  reference: string;
  status: string;
  consignee_name?: string | null;
};

export type RouteSummary = {
  id: string;
  code: string;
  route_date: string;
  status: string;
  stops_count?: number;
};

export type QualitySnapshot = {
  id: string;
  scope_type: 'driver' | 'subcontractor' | 'route';
  scope_id: string;
  scope_label?: string | null;
  hub_id?: string | null;
  subcontractor_id?: string | null;
  period_start: string;
  period_end: string;
  service_quality_score: number;
  assigned_with_attempt: number;
  delivered_completed: number;
  pickups_completed: number;
};

export type QualityTopRoutesResult = {
  data: QualitySnapshot[];
  meta: {
    threshold: number;
    count: number;
  };
};

export type QualityRiskSummaryRow = {
  group_type: 'hub' | 'subcontractor';
  group_id: string;
  group_label: string;
  routes_count: number;
  routes_under_threshold: number;
  under_threshold_ratio: number;
  avg_score: number;
  worst_route_id?: string | null;
  worst_route_label?: string | null;
  worst_route_score?: number | null;
};

export type QualityRiskSummaryResult = {
  data: QualityRiskSummaryRow[];
  meta: {
    threshold: number;
    group_by: 'hub' | 'subcontractor';
  };
};

export type IncidentSummary = {
  id: string;
  incidentable_type: 'shipment' | 'pickup';
  incidentable_id: string;
  catalog_code: string;
  category: 'failed' | 'absent' | 'retry' | 'general';
  notes?: string | null;
  resolved_at?: string | null;
};

export type IncidentCatalogItem = {
  code: string;
  name: string;
  category: 'failed' | 'absent' | 'retry' | 'general';
  applies_to: 'shipment' | 'pickup' | 'both';
};

export type TariffSummary = {
  id: string;
  service_type: 'delivery' | 'pickup_normal' | 'pickup_return';
  amount_cents: number;
  currency: string;
  valid_from: string;
  valid_to?: string | null;
  hub_id?: string | null;
  subcontractor_id?: string | null;
};

export type AdvanceSummary = {
  id: string;
  subcontractor_id: string;
  subcontractor_name?: string;
  amount_cents: number;
  currency: string;
  status: 'requested' | 'approved' | 'rejected' | 'deducted';
  reason?: string | null;
  request_date: string;
  approved_at?: string | null;
};

export type SettlementPreviewLine = {
  line_type: string;
  source_ref?: string | null;
  line_total_cents: number;
  status: 'payable' | 'excluded';
  exclusion_reason?: string | null;
};

export type SettlementPreview = {
  subcontractor: { id: string; legal_name: string };
  period: { label: string; start: string; end: string };
  tariffs: Record<string, number>;
  totals: {
    gross_amount_cents: number;
    advances_amount_cents: number;
    net_amount_cents: number;
  };
  lines: SettlementPreviewLine[];
};

export type SettlementSummary = {
  id: string;
  subcontractor_id: string;
  subcontractor_name?: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'approved' | 'exported' | 'paid';
  gross_amount_cents: number;
  advances_amount_cents: number;
  adjustments_amount_cents?: number;
  net_amount_cents: number;
  currency: string;
};

export type SettlementDetail = {
  settlement: SettlementSummary;
  lines: Array<{
    id: string;
    line_type: string;
    source_ref?: string | null;
    status: 'payable' | 'excluded';
    line_total_cents: number;
    exclusion_reason?: string | null;
  }>;
};

export type SettlementRecalculatePreview = {
  settlement: {
    id: string;
    subcontractor_id: string;
    period_start: string;
    period_end: string;
    status: 'draft' | 'approved' | 'exported' | 'paid';
    currency: string;
  };
  totals: {
    gross_amount_cents: number;
    advances_amount_cents: number;
    adjustments_amount_cents: number;
    net_amount_cents: number;
  };
  manual_adjustments: Array<{
    id: string;
    line_type: string;
    source_ref?: string | null;
    line_total_cents: number;
    status: 'payable' | 'excluded';
    exclusion_reason?: string | null;
  }>;
  lines_count: number;
};

export type SettlementAdjustment = {
  id: string;
  settlement_id: string;
  amount_cents: number;
  currency: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_by_user_id?: string | null;
  approved_at?: string | null;
  approved_by_user_id?: string | null;
};

export type SubcontractorSummary = {
  id: string;
  legal_name: string;
  tax_id?: string | null;
  status: string;
};

export type LoginResponse = {
  message: string;
  token?: string;
  token_type?: 'Bearer';
};

export type AuditLogEntry = {
  id: number;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_roles?: string | null;
  event: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};
