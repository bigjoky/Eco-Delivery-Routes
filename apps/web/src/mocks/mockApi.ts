export const mockApi = {
  async login(_: { email: string; password: string }) {
    return { message: 'Login mock OK', token: 'mock-token' };
  },

  async getCurrentUser() {
    return {
      id: 'u-1',
      name: 'Admin Demo',
      email: 'admin@eco.local',
      status: 'active',
      roles: [
        { id: 'r-1', code: 'super_admin', name: 'Super Admin' },
      ],
    };
  },

  async getUsers() {
    return [
      { id: 'u-1', name: 'Admin Demo', email: 'admin@eco.local', status: 'active' },
      { id: 'u-2', name: 'Ops Demo', email: 'ops@eco.local', status: 'active' },
    ];
  },

  async getAuditLogs(_: {
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff';
    id?: string;
    event?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  }) {
    return [
      {
        id: 1,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'settlement.adjustment.created',
        metadata: { settlement_id: 'st-1', adjustment_id: 'sa-1' },
        created_at: '2026-02-27T10:00:00Z',
      },
      {
        id: 2,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'settlement.adjustment.approved',
        metadata: { settlement_id: 'st-1', adjustment_id: 'sa-1' },
        created_at: '2026-02-27T10:05:00Z',
      },
    ];
  },

  async exportAuditLogsCsv(_: {
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff';
    id?: string;
    event?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return;
  },

  async getRoles() {
    return [
      { id: 'r-1', code: 'super_admin', name: 'Super Admin' },
      { id: 'r-2', code: 'operations_manager', name: 'Operations Manager' },
      { id: 'r-3', code: 'driver', name: 'Driver' },
    ];
  },

  async getShipments() {
    return [
      { id: 's-1', reference: 'SHP-AGP-0001', status: 'out_for_delivery', consignee_name: 'Cliente Demo' },
      { id: 's-2', reference: 'SHP-AGP-0002', status: 'delivered', consignee_name: 'Cliente Centro' },
    ];
  },

  async getRoutes() {
    return [
      { id: 'r-1', code: 'R-AGP-20260227', route_date: '2026-02-27', status: 'in_progress', stops_count: 28 },
    ];
  },

  async getQualitySnapshots(filters: {
    scopeType?: 'driver' | 'subcontractor' | 'route';
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const rows = [
      {
        id: 'q-1',
        scope_type: 'driver',
        scope_id: 'drv-1',
        scope_label: 'DRV-AGP-001',
        hub_id: '00000000-0000-0000-0000-000000000001',
        subcontractor_id: 'sc-1',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        service_quality_score: 96.2,
        assigned_with_attempt: 450,
        delivered_completed: 430,
        pickups_completed: 3,
      },
      {
        id: 'q-2',
        scope_type: 'route',
        scope_id: 'r-1',
        scope_label: 'R-AGP-20260227',
        hub_id: '00000000-0000-0000-0000-000000000001',
        subcontractor_id: 'sc-1',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        service_quality_score: 94.5,
        assigned_with_attempt: 120,
        delivered_completed: 110,
        pickups_completed: 3,
      },
    ];
    if (filters.scopeType) {
      return rows
        .filter((row) => row.scope_type === filters.scopeType)
        .filter((row) => (filters.hubId ? row.hub_id === filters.hubId : true))
        .filter((row) => (filters.subcontractorId ? row.subcontractor_id === filters.subcontractorId : true))
        .filter((row) => (filters.periodStart ? row.period_start >= filters.periodStart : true))
        .filter((row) => (filters.periodEnd ? row.period_end <= filters.periodEnd : true));
    }
    return rows
      .filter((row) => (filters.hubId ? row.hub_id === filters.hubId : true))
      .filter((row) => (filters.subcontractorId ? row.subcontractor_id === filters.subcontractorId : true))
      .filter((row) => (filters.periodStart ? row.period_start >= filters.periodStart : true))
      .filter((row) => (filters.periodEnd ? row.period_end <= filters.periodEnd : true));
  },

  async getQualityTopRoutesUnderThreshold(filters: {
    threshold?: number;
    limit?: number;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const threshold = filters.threshold ?? 95;
    const limit = filters.limit ?? 10;
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      hubId: filters.hubId,
      subcontractorId: filters.subcontractorId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    });
    const data = rows
      .filter((row) => row.service_quality_score < threshold)
      .sort((a, b) => a.service_quality_score - b.service_quality_score)
      .slice(0, limit);

    return {
      data,
      meta: {
        threshold,
        count: data.length,
      },
    };
  },

  async getQualityRiskSummary(filters: {
    threshold?: number;
    groupBy?: 'hub' | 'subcontractor';
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const threshold = filters.threshold ?? 95;
    const groupBy = filters.groupBy ?? 'hub';
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      hubId: filters.hubId,
      subcontractorId: filters.subcontractorId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    });

    const groups = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const key = groupBy === 'hub' ? row.hub_id ?? 'unknown' : row.subcontractor_id ?? 'unknown';
      const current = groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
    });

    const data = Array.from(groups.entries()).map(([groupId, groupRows]) => {
      const under = groupRows.filter((row) => row.service_quality_score < threshold);
      const worst = groupRows.slice().sort((a, b) => a.service_quality_score - b.service_quality_score)[0];
      return {
        group_type: groupBy,
        group_id: groupId,
        group_label: groupBy === 'hub' ? (groupId === 'unknown' ? groupId : 'AGP-HUB-01') : (groupId === 'unknown' ? groupId : 'Ruta Sur Express SL'),
        routes_count: groupRows.length,
        routes_under_threshold: under.length,
        under_threshold_ratio: groupRows.length > 0 ? Number(((under.length / groupRows.length) * 100).toFixed(2)) : 0,
        avg_score: groupRows.length > 0 ? Number((groupRows.reduce((acc, row) => acc + row.service_quality_score, 0) / groupRows.length).toFixed(2)) : 0,
        worst_route_id: worst?.scope_id ?? null,
        worst_route_label: worst?.scope_label ?? worst?.scope_id ?? null,
        worst_route_score: worst?.service_quality_score ?? null,
      };
    });

    return {
      data,
      meta: {
        threshold,
        group_by: groupBy,
      },
    };
  },

  async exportQualityCsv(_: {
    scopeType?: 'driver' | 'subcontractor' | 'route';
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return;
  },

  async exportQualityPdf(_: {
    threshold?: number;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return;
  },

  async getIncidents() {
    return [
      {
        id: 'i-1',
        incidentable_type: 'shipment',
        incidentable_id: 'SHP-AGP-0001',
        catalog_code: 'ABSENT_HOME',
        category: 'absent',
        notes: 'Cliente no localizado',
        resolved_at: null,
      },
    ];
  },

  async createIncident(payload: {
    incidentable_type: 'shipment' | 'pickup';
    incidentable_id: string;
    catalog_code: string;
    category: 'failed' | 'absent' | 'retry' | 'general';
    notes?: string;
  }) {
    return {
      id: 'i-new',
      ...payload,
      resolved_at: null,
    };
  },

  async getIncidentCatalog() {
    return [
      { code: 'ABSENT_HOME', name: 'Destinatario ausente', category: 'absent', applies_to: 'shipment' },
      { code: 'RETRY_WINDOW', name: 'Reintento por franja horaria', category: 'retry', applies_to: 'shipment' },
      { code: 'FAILED_ADDRESS', name: 'Direccion invalida', category: 'failed', applies_to: 'shipment' },
      { code: 'PICKUP_CLIENT_NOT_READY', name: 'Cliente no preparado para recogida', category: 'general', applies_to: 'pickup' },
    ];
  },

  async getTariffs() {
    return [
      { id: 't-1', service_type: 'delivery', amount_cents: 250, currency: 'EUR', valid_from: '2026-02-01' },
      { id: 't-2', service_type: 'pickup_normal', amount_cents: 190, currency: 'EUR', valid_from: '2026-02-01' },
      { id: 't-3', service_type: 'pickup_return', amount_cents: 190, currency: 'EUR', valid_from: '2026-02-01' },
    ];
  },

  async createTariff(_: {
    service_type: 'delivery' | 'pickup_normal' | 'pickup_return';
    amount_cents: number;
    currency: string;
    valid_from: string;
    subcontractor_id?: string;
  }) {
    return { id: 't-new' };
  },

  async updateTariff(_: string, __: { amount_cents: number; valid_from?: string; is_active?: boolean }) {
    return;
  },

  async getSettlementPreview(_: { subcontractorId: string; period: string }) {
    return {
      subcontractor: { id: 'sc-1', legal_name: 'Ruta Sur Express SL' },
      period: { label: '2026-02', start: '2026-02-01', end: '2026-02-28' },
      tariffs: { delivery: 250, pickup_normal: 190, pickup_return: 190 },
      totals: { gross_amount_cents: 12950, advances_amount_cents: 5000, net_amount_cents: 7950 },
      lines: [
        { line_type: 'shipment_delivery', source_ref: 'SHP-AGP-0001', line_total_cents: 250, status: 'payable' },
        { line_type: 'pickup_normal', source_ref: 'PCK-AGP-0001', line_total_cents: 190, status: 'payable' },
        { line_type: 'advance_deduction', source_ref: 'ADV-1', line_total_cents: -5000, status: 'payable' },
      ],
    };
  },

  async getSettlements(_: { status?: string; period?: string; subcontractorId?: string }) {
    return [
      {
        id: 'st-1',
        subcontractor_id: 'sc-1',
        subcontractor_name: 'Ruta Sur Express SL',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'approved',
        gross_amount_cents: 12950,
        advances_amount_cents: 5000,
        net_amount_cents: 7950,
        currency: 'EUR',
      },
    ];
  },

  async getSettlementDetail(_: string) {
    return {
      settlement: {
        id: 'st-1',
        subcontractor_id: 'sc-1',
        subcontractor_name: 'Ruta Sur Express SL',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'approved',
        gross_amount_cents: 12950,
        advances_amount_cents: 5000,
        net_amount_cents: 7950,
        currency: 'EUR',
      },
      lines: [
        {
          id: 'sl-1',
          line_type: 'shipment_delivery',
          source_ref: 'SHP-AGP-0001',
          status: 'payable',
          line_total_cents: 250,
          exclusion_reason: null,
        },
      ],
    };
  },

  async getSettlementAdjustments(_: string) {
    return [
      {
        id: 'sa-1',
        settlement_id: 'st-1',
        amount_cents: -250,
        currency: 'EUR',
        reason: 'Correccion incidencia',
        status: 'approved',
        rejection_reason: null,
      },
    ];
  },

  async createSettlementAdjustment(_: string, __: { amount_cents: number; reason: string }) {
    return { id: 'sa-new' };
  },

  async previewSettlementRecalculate(
    _: string,
    payload: { manual_adjustments?: Array<{ amount_cents: number; reason: string }> } = {}
  ) {
    const baseGross = 12950;
    const baseAdvances = 5000;
    const adjustments = (payload.manual_adjustments ?? []).reduce((acc, item) => acc + item.amount_cents, 0);
    return {
      settlement: {
        id: 'st-1',
        subcontractor_id: 'sc-1',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'draft',
        currency: 'EUR',
      },
      totals: {
        gross_amount_cents: baseGross,
        advances_amount_cents: baseAdvances,
        adjustments_amount_cents: adjustments,
        net_amount_cents: baseGross - baseAdvances + adjustments,
      },
      manual_adjustments: (payload.manual_adjustments ?? []).map((item, index) => ({
        id: `preview-adjustment-${index + 1}`,
        line_type: 'manual_adjustment',
        source_ref: item.reason,
        line_total_cents: item.amount_cents,
        status: 'payable',
        exclusion_reason: null,
      })),
      lines_count: 3 + (payload.manual_adjustments?.length ?? 0),
    };
  },

  async recalculateSettlement(_: string) {
    return;
  },

  async updateSettlementAdjustment(_: string, __: string, ___: { amount_cents?: number; reason?: string }) {
    return;
  },

  async approveSettlementAdjustment(_: string, __: string) {
    return;
  },

  async rejectSettlementAdjustment(_: string, __: string, ___: string) {
    return;
  },

  async reconcileSettlementLine(
    _: string,
    __: string,
    ___: { status: 'payable' | 'excluded'; exclusion_reason?: string | null }
  ) {
    return;
  },

  async exportSettlementCsv(_: string) {
    return;
  },

  async exportSettlementPdf(_: string) {
    return;
  },

  async getSubcontractors(_: { q?: string; limit?: number }) {
    return [
      {
        id: 'sc-1',
        legal_name: 'Ruta Sur Express SL',
        tax_id: 'B00000001',
        status: 'active',
      },
    ];
  },

  async getAdvances(_: { subcontractorId?: string; status?: string; period?: string }) {
    return [
      {
        id: 'a-1',
        subcontractor_id: 'sc-1',
        subcontractor_name: 'Ruta Sur Express SL',
        amount_cents: 5000,
        currency: 'EUR',
        status: 'approved',
        reason: 'Anticipo operativo inicial',
        request_date: '2026-02-03',
        approved_at: '2026-02-03T10:00:00Z',
      },
    ];
  },

  async createAdvance(_: {
    subcontractor_id: string;
    amount_cents: number;
    currency: string;
    request_date: string;
    reason?: string;
  }) {
    return { id: 'a-new' };
  },

  async updateAdvance(_: string, __: { amount_cents?: number; request_date?: string; reason?: string }) {
    return;
  },

  async approveAdvance(_: string) {
    return;
  },

  async exportAdvancesCsv(_: { subcontractorId?: string; status?: string; period?: string }) {
    return;
  },
};
