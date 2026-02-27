let trackingSeq = 1;
let podSeq = 1;

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

  async getHubs(_: { onlyActive?: boolean } = {}) {
    return [
      { id: 'hub-1', code: 'AGP-HUB-01', name: 'Hub Malaga Centro', city: 'Malaga', is_active: true },
      { id: 'hub-2', code: 'SEV-HUB-01', name: 'Hub Sevilla Norte', city: 'Sevilla', is_active: true },
    ];
  },

  async getShipments(filters: { status?: string } = {}) {
    const rows = [
      { id: 's-1', reference: 'SHP-AGP-0001', status: 'out_for_delivery', consignee_name: 'Cliente Demo' },
      { id: 's-2', reference: 'SHP-AGP-0002', status: 'delivered', consignee_name: 'Cliente Centro' },
    ];
    if (!filters.status) return rows;
    return rows.filter((row) => row.status === filters.status);
  },

  async getRoutes(filters: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
  } = {}) {
    let rows = [
      { id: 'r-1', code: 'R-AGP-20260227', route_date: '2026-02-27', status: 'in_progress', stops_count: 28 },
      { id: 'r-2', code: 'R-AGP-20260228', route_date: '2026-02-28', status: 'planned', stops_count: 24 },
      { id: 'r-3', code: 'R-AGP-20260301', route_date: '2026-03-01', status: 'completed', stops_count: 31 },
    ];
    if (filters.status) {
      rows = rows.filter((row) => row.status === filters.status);
    }
    if (filters.dateFrom) {
      const from = filters.dateFrom;
      rows = rows.filter((row) => row.route_date >= from);
    }
    if (filters.dateTo) {
      const to = filters.dateTo;
      rows = rows.filter((row) => row.route_date <= to);
    }
    const sortKey = filters.sort === 'code' ? 'code' : 'route_date';
    const dir = filters.dir === 'asc' ? 1 : -1;
    rows = rows.slice().sort((a, b) => (a[sortKey] > b[sortKey] ? dir : -dir));
    return rows;
  },

  async getRouteStops(routeId: string) {
    const all = [
      {
        id: 'st-1',
        route_id: 'r-1',
        sequence: 1,
        stop_type: 'DELIVERY',
        status: 'in_progress',
        shipment_id: '00000000-0000-0000-0000-000000000101',
        pickup_id: null,
        entity_type: 'shipment',
        entity_id: '00000000-0000-0000-0000-000000000101',
        reference: 'SHP-AGP-0001',
      },
      {
        id: 'st-2',
        route_id: 'r-1',
        sequence: 2,
        stop_type: 'PICKUP',
        status: 'planned',
        shipment_id: null,
        pickup_id: '00000000-0000-0000-0000-000000000201',
        entity_type: 'pickup',
        entity_id: '00000000-0000-0000-0000-000000000201',
        reference: 'PCK-AGP-0001',
      },
    ];
    return all.filter((row) => row.route_id === routeId);
  },

  async getMyDriverRoute(filters: { routeDate?: string; status?: string } = {}) {
    const route = {
      id: 'r-1',
      code: 'R-AGP-20260227',
      route_date: '2026-02-27',
      status: 'in_progress',
    };
    if (filters.routeDate && filters.routeDate !== route.route_date) {
      return { route: null, stops: [] };
    }
    if (filters.status && filters.status !== route.status) {
      return { route: null, stops: [] };
    }
    return {
      driver: { id: 'drv-1', code: 'DRV-AGP-001', name: 'Driver Demo' },
      route,
      stops: await this.getRouteStops(route.id),
    };
  },

  async registerScan(payload: {
    trackable_type: 'shipment' | 'pickup';
    trackable_id: string;
    event_code: string;
    scan_code: string;
    occurred_at: string;
  }) {
    const id = `te-${trackingSeq++}`;
    return { id, ...payload };
  },

  async registerPod(payload: {
    evidenceable_type: 'shipment' | 'pickup';
    evidenceable_id: string;
    signature_name: string;
  }) {
    const id = `pod-${podSeq++}`;
    return { id, ...payload };
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
        failed_count: 8,
        absent_count: 6,
        retry_count: 3,
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
        failed_count: 4,
        absent_count: 2,
        retry_count: 1,
      },
    ];
    if (filters.scopeType) {
      return rows
        .filter((row) => row.scope_type === filters.scopeType)
        .filter((row) => (filters.scopeId ? row.scope_id === filters.scopeId : true))
        .filter((row) => (filters.hubId ? row.hub_id === filters.hubId : true))
        .filter((row) => (filters.subcontractorId ? row.subcontractor_id === filters.subcontractorId : true))
        .filter((row) => (filters.periodStart ? row.period_start >= filters.periodStart : true))
        .filter((row) => (filters.periodEnd ? row.period_end <= filters.periodEnd : true));
    }
    return rows
      .filter((row) => (filters.scopeId ? row.scope_id === filters.scopeId : true))
      .filter((row) => (filters.hubId ? row.hub_id === filters.hubId : true))
      .filter((row) => (filters.subcontractorId ? row.subcontractor_id === filters.subcontractorId : true))
      .filter((row) => (filters.periodStart ? row.period_start >= filters.periodStart : true))
      .filter((row) => (filters.periodEnd ? row.period_end <= filters.periodEnd : true));
  },

  async getQualityTopRoutesUnderThreshold(filters: {
    threshold?: number;
    limit?: number;
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const threshold = filters.threshold ?? 95;
    const limit = filters.limit ?? 10;
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      scopeId: filters.scopeId,
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
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const threshold = filters.threshold ?? 95;
    const groupBy = filters.groupBy ?? 'hub';
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      scopeId: filters.scopeId,
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
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return;
  },

  async exportQualityPdf(_: {
    threshold?: number;
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return;
  },

  async getQualityRouteBreakdown(routeId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}) {
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      scopeId: routeId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    }) as Array<{
      id: string;
      scope_id: string;
      scope_label?: string;
      hub_id?: string;
      subcontractor_id?: string;
      period_start: string;
      period_end: string;
      service_quality_score: number;
      assigned_with_attempt: number;
      delivered_completed: number;
      pickups_completed: number;
      failed_count?: number;
      absent_count?: number;
      retry_count?: number;
    }>;

    const assigned = rows.reduce((acc, row) => acc + row.assigned_with_attempt, 0);
    const delivered = rows.reduce((acc, row) => acc + row.delivered_completed, 0);
    const pickups = rows.reduce((acc, row) => acc + row.pickups_completed, 0);
    const failed = rows.reduce((acc, row) => acc + (row.failed_count ?? 0), 0);
    const absent = rows.reduce((acc, row) => acc + (row.absent_count ?? 0), 0);
    const retry = rows.reduce((acc, row) => acc + (row.retry_count ?? 0), 0);
    const completed = delivered + pickups;
    const ratio = assigned > 0 ? Number(((completed / assigned) * 100).toFixed(2)) : 0;
    const latest = rows[0];
    const granularity = filters.granularity ?? 'month';

    const periodGroups = rows.reduce((acc, row) => {
      const key = granularity === 'week'
        ? `${row.period_end.slice(0, 4)}-W${String(Math.ceil(Number(row.period_end.slice(8, 10)) / 7)).padStart(2, '0')}`
        : row.period_end.slice(0, 7);
      const current = acc.get(key) ?? [];
      current.push(row);
      acc.set(key, current);
      return acc;
    }, new Map<string, typeof rows>());

    const periods = Array.from(periodGroups.entries()).map(([periodKey, periodRows]) => {
      const periodAssigned = periodRows.reduce((acc, row) => acc + row.assigned_with_attempt, 0);
      const periodDelivered = periodRows.reduce((acc, row) => acc + row.delivered_completed, 0);
      const periodPickups = periodRows.reduce((acc, row) => acc + row.pickups_completed, 0);
      const periodFailed = periodRows.reduce((acc, row) => acc + (row.failed_count ?? 0), 0);
      const periodAbsent = periodRows.reduce((acc, row) => acc + (row.absent_count ?? 0), 0);
      const periodRetry = periodRows.reduce((acc, row) => acc + (row.retry_count ?? 0), 0);
      const periodCompleted = periodDelivered + periodPickups;
      const periodRatio = periodAssigned > 0 ? Number(((periodCompleted / periodAssigned) * 100).toFixed(2)) : 0;
      return {
        period_key: periodKey,
        period_start: periodRows[periodRows.length - 1]?.period_start ?? '',
        period_end: periodRows[0]?.period_end ?? '',
        service_quality_score: periodRatio,
        components: {
          assigned_with_attempt: periodAssigned,
          delivered_completed: periodDelivered,
          pickups_completed: periodPickups,
          failed_count: periodFailed,
          absent_count: periodAbsent,
          retry_count: periodRetry,
          completed_total: periodCompleted,
          completion_ratio: periodRatio,
        },
      };
    });

    return {
      scope_type: 'route',
      scope_id: routeId,
      scope_label: latest?.scope_label ?? routeId,
      route_id: routeId,
      route_code: latest?.scope_label ?? routeId,
      hub_id: latest?.hub_id ?? null,
      subcontractor_id: latest?.subcontractor_id ?? null,
      granularity,
      latest_snapshot_id: latest?.id ?? null,
      latest_period_start: latest?.period_start ?? null,
      latest_period_end: latest?.period_end ?? null,
      snapshots_count: rows.length,
      service_quality_score: ratio,
      periods,
      components: {
        assigned_with_attempt: assigned,
        delivered_completed: delivered,
        pickups_completed: pickups,
        failed_count: failed,
        absent_count: absent,
        retry_count: retry,
        completed_total: completed,
        completion_ratio: ratio,
      },
    };
  },

  async exportQualityRouteBreakdownCsv(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  }) {
    return;
  },

  async exportQualityRouteBreakdownPdf(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  }) {
    return;
  },

  async getQualityDriverBreakdown(driverId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}) {
    const rows = await this.getQualitySnapshots({
      scopeType: 'driver',
      scopeId: driverId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    }) as Array<{
      id: string;
      scope_id: string;
      scope_label?: string;
      hub_id?: string;
      subcontractor_id?: string;
      period_start: string;
      period_end: string;
      assigned_with_attempt: number;
      delivered_completed: number;
      pickups_completed: number;
      failed_count?: number;
      absent_count?: number;
      retry_count?: number;
    }>;

    const assigned = rows.reduce((acc, row) => acc + row.assigned_with_attempt, 0);
    const delivered = rows.reduce((acc, row) => acc + row.delivered_completed, 0);
    const pickups = rows.reduce((acc, row) => acc + row.pickups_completed, 0);
    const failed = rows.reduce((acc, row) => acc + (row.failed_count ?? 0), 0);
    const absent = rows.reduce((acc, row) => acc + (row.absent_count ?? 0), 0);
    const retry = rows.reduce((acc, row) => acc + (row.retry_count ?? 0), 0);
    const completed = delivered + pickups;
    const ratio = assigned > 0 ? Number(((completed / assigned) * 100).toFixed(2)) : 0;
    const granularity = filters.granularity ?? 'month';
    const latest = rows[0];

    return {
      scope_type: 'driver',
      scope_id: driverId,
      scope_label: latest?.scope_label ?? driverId,
      driver_id: driverId,
      driver_code: latest?.scope_label ?? driverId,
      hub_id: latest?.hub_id ?? null,
      subcontractor_id: latest?.subcontractor_id ?? null,
      granularity,
      latest_snapshot_id: latest?.id ?? null,
      latest_period_start: latest?.period_start ?? null,
      latest_period_end: latest?.period_end ?? null,
      snapshots_count: rows.length,
      service_quality_score: ratio,
      periods: [{
        period_key: granularity === 'week' ? '2026-W08' : '2026-02',
        period_start: rows[rows.length - 1]?.period_start ?? '2026-02-01',
        period_end: rows[0]?.period_end ?? '2026-02-28',
        service_quality_score: ratio,
        components: {
          assigned_with_attempt: assigned,
          delivered_completed: delivered,
          pickups_completed: pickups,
          failed_count: failed,
          absent_count: absent,
          retry_count: retry,
          completed_total: completed,
          completion_ratio: ratio,
        },
      }],
      components: {
        assigned_with_attempt: assigned,
        delivered_completed: delivered,
        pickups_completed: pickups,
        failed_count: failed,
        absent_count: absent,
        retry_count: retry,
        completed_total: completed,
        completion_ratio: ratio,
      },
    };
  },

  async exportQualityDriverBreakdownCsv(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  }) {
    return;
  },

  async exportQualityDriverBreakdownPdf(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
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

  async getSettlementReconciliationReasons() {
    return [
      { id: 'sr-1', code: 'NO_POD', name: 'Sin POD valido', is_active: true },
      { id: 'sr-2', code: 'RETRY_NOT_PAYABLE', name: 'Reintento no pagable', is_active: true },
      { id: 'sr-3', code: 'ABSENCE_NOT_PAYABLE', name: 'Ausencia no pagable', is_active: true },
      { id: 'sr-4', code: 'INCIDENT_REVIEW', name: 'Incidencia en revision contable', is_active: true },
      { id: 'sr-5', code: 'MANUAL_AUDIT', name: 'Ajuste manual de auditoria', is_active: true },
    ];
  },

  async getSettlementReconciliationSummary(_: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  }) {
    return [
      { exclusion_code: 'MANUAL_AUDIT', lines_count: 3, excluded_amount_cents: 760 },
      { exclusion_code: 'RETRY_NOT_PAYABLE', lines_count: 2, excluded_amount_cents: 380 },
    ];
  },

  async exportSettlementReconciliationSummaryCsv(_: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  }) {
    return;
  },

  async exportSettlementReconciliationSummaryPdf(_: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  }) {
    return;
  },

  async getSettlementReconciliationTrends(_: {
    granularity?: 'week' | 'month';
    limit?: number;
    period?: string;
    subcontractorId?: string;
    hubId?: string;
  } = {}) {
    return [
      { period_bucket: '2026-02', exclusion_code: 'MANUAL_AUDIT', lines_count: 3, excluded_amount_cents: 760 },
      { period_bucket: '2026-02', exclusion_code: 'RETRY_NOT_PAYABLE', lines_count: 2, excluded_amount_cents: 380 },
      { period_bucket: '2026-01', exclusion_code: 'MANUAL_AUDIT', lines_count: 1, excluded_amount_cents: 250 },
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
    ___: { status: 'payable' | 'excluded'; exclusion_code?: string | null }
  ) {
    return;
  },

  async reconcileSettlementLinesBulk(
    _: string,
    __: {
      status: 'payable' | 'excluded';
      exclusion_code?: string | null;
      line_type?: 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment';
      current_status?: 'payable' | 'excluded';
      route_id?: string;
      subcontractor_id?: string;
      line_ids?: string[];
    }
  ) {
    return { affected_count: 1 };
  },

  async previewReconcileSettlementLinesBulk(
    _: string,
    __: {
      status: 'payable' | 'excluded';
      exclusion_code?: string | null;
      line_type?: 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment';
      current_status?: 'payable' | 'excluded';
      route_id?: string;
      subcontractor_id?: string;
      line_ids?: string[];
    }
  ) {
    return {
      affected_count: 1,
      before_totals: {
        gross_amount_cents: 12950,
        advances_amount_cents: 5000,
        adjustments_amount_cents: -250,
        net_amount_cents: 7700,
      },
      after_totals: {
        gross_amount_cents: 12760,
        advances_amount_cents: 5000,
        adjustments_amount_cents: -250,
        net_amount_cents: 7510,
      },
      filters: {
        line_type: 'pickup_normal',
        current_status: 'payable',
        route_id: null,
        subcontractor_id: null,
        line_ids_count: 0,
      },
    };
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
