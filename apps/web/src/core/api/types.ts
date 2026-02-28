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

export type HubSummary = {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  is_active: boolean;
};

export type RouteStopSummary = {
  id: string;
  route_id: string;
  sequence: number;
  stop_type: 'DELIVERY' | 'PICKUP';
  status: string;
  shipment_id?: string | null;
  pickup_id?: string | null;
  entity_type: 'shipment' | 'pickup';
  entity_id: string;
  reference?: string | null;
  planned_at?: string | null;
  completed_at?: string | null;
};

export type DriverRouteMeResponse = {
  driver?: {
    id: string;
    code: string;
    name: string;
  } | null;
  route?: {
    id: string;
    code: string;
    route_date: string;
    status: string;
  } | null;
  stops: RouteStopSummary[];
};

export type TrackingEventSummary = {
  id: string;
  trackable_type: 'shipment' | 'pickup';
  trackable_id: string;
  event_code: string;
  scan_code: string;
  occurred_at: string;
};

export type PodSummary = {
  id: string;
  evidenceable_type: 'shipment' | 'pickup';
  evidenceable_id: string;
  signature_name: string;
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

export type QualityThresholdConfig = {
  threshold: number;
  source_type: 'default' | 'global' | 'role' | 'user';
  source_id?: string | null;
  can_manage?: boolean;
};

export type QualityThresholdAlertSettings = {
  large_delta_threshold: number;
  window_hours: number;
  can_manage?: boolean;
  source_type?: 'default' | 'configured';
};

export type QualityThresholdHistoryEntry = {
  id: number;
  event: string;
  actor_user_id?: string | null;
  actor_name?: string | null;
  created_at: string;
  scope_type: 'global' | 'role' | 'user';
  scope_id?: string | null;
  before_threshold?: number | null;
  after_threshold?: number | null;
  metadata?: Record<string, unknown> | string | null;
};

export type QualityThresholdAlertSummary = {
  event: string;
  count: number;
  last_event_at?: string | null;
  window_hours: number;
  large_delta_threshold: number;
  date_from: string;
  date_to: string;
};

export type QualityRouteBreakdown = {
  scope_type: 'route';
  scope_id: string;
  scope_label?: string | null;
  route_id: string;
  route_code?: string | null;
  driver_id?: string | null;
  driver_code?: string | null;
  hub_id?: string | null;
  subcontractor_id?: string | null;
  granularity: 'week' | 'month';
  latest_snapshot_id?: string | null;
  latest_period_start?: string | null;
  latest_period_end?: string | null;
  snapshots_count: number;
  service_quality_score: number;
  periods: Array<{
    period_key: string;
    period_start: string;
    period_end: string;
    service_quality_score: number;
    components: {
      assigned_with_attempt: number;
      delivered_completed: number;
      pickups_completed: number;
      failed_count: number;
      absent_count: number;
      retry_count: number;
      completed_total: number;
      completion_ratio: number;
    };
  }>;
  components: {
    assigned_with_attempt: number;
    delivered_completed: number;
    pickups_completed: number;
    failed_count: number;
    absent_count: number;
    retry_count: number;
    completed_total: number;
    completion_ratio: number;
  };
};

export type QualityDriverBreakdown = {
  scope_type: 'driver';
  scope_id: string;
  scope_label?: string | null;
  driver_id: string;
  driver_code?: string | null;
  hub_id?: string | null;
  subcontractor_id?: string | null;
  granularity: 'week' | 'month';
  latest_snapshot_id?: string | null;
  latest_period_start?: string | null;
  latest_period_end?: string | null;
  snapshots_count: number;
  service_quality_score: number;
  periods: QualityRouteBreakdown['periods'];
  components: QualityRouteBreakdown['components'];
};

export type QualitySubcontractorBreakdown = {
  scope_type: 'subcontractor';
  scope_id: string;
  scope_label?: string | null;
  subcontractor_id: string;
  subcontractor_code?: string | null;
  granularity: 'week' | 'month';
  latest_snapshot_id?: string | null;
  latest_period_start?: string | null;
  latest_period_end?: string | null;
  snapshots_count: number;
  service_quality_score: number;
  periods: QualityRouteBreakdown['periods'];
  components: QualityRouteBreakdown['components'];
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
    source_id?: string | null;
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

export type SettlementReconciliationReason = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type SettlementReconciliationSummaryRow = {
  exclusion_code: string;
  lines_count: number;
  excluded_amount_cents: number;
};

export type SettlementReconciliationTrendRow = {
  period_bucket: string;
  exclusion_code: string;
  lines_count: number;
  excluded_amount_cents: number;
};

export type SettlementBulkReconcilePreview = {
  affected_count: number;
  before_totals: {
    gross_amount_cents: number;
    advances_amount_cents: number;
    adjustments_amount_cents: number;
    net_amount_cents: number;
  };
  after_totals: {
    gross_amount_cents: number;
    advances_amount_cents: number;
    adjustments_amount_cents: number;
    net_amount_cents: number;
  };
  filters: {
    line_type?: string | null;
    current_status?: string | null;
    route_id?: string | null;
    subcontractor_id?: string | null;
    line_ids_count: number;
  };
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
  user?: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
};

export type CurrentUserProfile = {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: Array<{ id: string; code: string; name: string }>;
};

export type AuditLogEntry = {
  id: number;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_roles?: string | null;
  event: string;
  metadata?: Record<string, unknown> | string | null;
  created_at: string;
};
