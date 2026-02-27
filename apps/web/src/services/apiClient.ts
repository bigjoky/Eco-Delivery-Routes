import {
  AuditLogEntry,
  AdvanceSummary,
  CurrentUserProfile,
  IncidentCatalogItem,
  IncidentSummary,
  LoginResponse,
  PaginatedResult,
  QualitySnapshot,
  QualityRiskSummaryResult,
  QualityTopRoutesResult,
  RoleSummary,
  RouteStopSummary,
  RouteSummary,
  SettlementDetail,
  SettlementAdjustment,
  SettlementBulkReconcilePreview,
  SettlementSummary,
  SettlementPreview,
  SettlementReconciliationReason,
  SettlementReconciliationSummaryRow,
  SettlementRecalculatePreview,
  SubcontractorSummary,
  ShipmentSummary,
  TariffSummary,
  UserSummary,
  DriverRouteMeResponse,
} from '../core/api/types';
import { sessionStore } from '../core/auth/sessionStore';
import { mockApi } from '../mocks/mockApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const USE_MOCK = !API_BASE_URL;

async function parseData<T>(response: Response): Promise<T[]> {
  const data = await response.json();
  return data.data ?? [];
}

async function parsePaginatedData<T>(response: Response): Promise<PaginatedResult<T>> {
  const json = await response.json();
  return {
    data: json.data ?? [],
    meta: json.meta ?? { page: 1, per_page: 20, total: 0, last_page: 0 },
  };
}

function paginateLocal<T>(items: T[], page: number, perPage: number): PaginatedResult<T> {
  const safePerPage = Math.max(1, perPage);
  const safePage = Math.max(1, page);
  const total = items.length;
  const lastPage = Math.ceil(total / safePerPage);
  const start = (safePage - 1) * safePerPage;
  const end = start + safePerPage;

  return {
    data: items.slice(start, end),
    meta: {
      page: safePage,
      per_page: safePerPage,
      total,
      last_page: lastPage,
    },
  };
}

export const apiClient = {
  async login(payload: { email: string; password: string }): Promise<LoginResponse> {
    if (USE_MOCK) return mockApi.login(payload);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as LoginResponse;
    sessionStore.setToken(data.token ?? null);
    try {
      await this.getCurrentUser();
    } catch {
      // Non-blocking; role context can be refreshed later.
    }
    return data;
  },

  async getCurrentUser(): Promise<CurrentUserProfile> {
    if (USE_MOCK) {
      const profile = await mockApi.getCurrentUser() as CurrentUserProfile;
      sessionStore.setRoles(profile.roles.map((role) => role.code));
      return profile;
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const data = await response.json();
    const profile = data.data as CurrentUserProfile;
    sessionStore.setRoles((profile.roles ?? []).map((role) => role.code));
    return profile;
  },

  async getUsers(): Promise<UserSummary[]> {
    if (USE_MOCK) return mockApi.getUsers();
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<UserSummary>(response);
  },

  async getAuditLogs(filters: {
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff';
    id?: string;
    event?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResult<AuditLogEntry>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    if (USE_MOCK) {
      return paginateLocal(await mockApi.getAuditLogs(filters), page, perPage);
    }

    const params = new URLSearchParams();
    if (filters.resource) params.set('resource', filters.resource);
    if (filters.id) params.set('id', filters.id);
    if (filters.event) params.set('event', filters.event);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const response = await fetch(`${API_BASE_URL}/audit-logs?${params.toString()}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parsePaginatedData<AuditLogEntry>(response);
  },

  async exportAuditLogsCsv(filters: {
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff';
    id?: string;
    event?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<void> {
    if (USE_MOCK) return mockApi.exportAuditLogsCsv(filters) as Promise<void>;

    const params = new URLSearchParams();
    if (filters.resource) params.set('resource', filters.resource);
    if (filters.id) params.set('id', filters.id);
    if (filters.event) params.set('event', filters.event);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/audit-logs/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'audit_logs_export.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async getRoles(): Promise<RoleSummary[]> {
    if (USE_MOCK) return mockApi.getRoles();
    const response = await fetch(`${API_BASE_URL}/roles`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<RoleSummary>(response);
  },

  async getShipments(filters: {
    page?: number;
    perPage?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
    status?: string;
  } = {}): Promise<PaginatedResult<ShipmentSummary>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;
    if (USE_MOCK) {
      return paginateLocal(await mockApi.getShipments(filters), page, perPage);
    }

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.dir) params.set('dir', filters.dir);
    if (filters.status) params.set('status', filters.status);
    const response = await fetch(`${API_BASE_URL}/shipments?${params.toString()}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parsePaginatedData<ShipmentSummary>(response);
  },

  async getRoutes(filters: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResult<RouteSummary>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;
    if (USE_MOCK) {
      return paginateLocal(await mockApi.getRoutes(filters), page, perPage);
    }
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (filters.status) params.set('status', filters.status);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.dir) params.set('dir', filters.dir);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/routes${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parsePaginatedData<RouteSummary>(response);
  },

  async getRouteStops(routeId: string): Promise<RouteStopSummary[]> {
    if (USE_MOCK) return mockApi.getRouteStops(routeId);
    const response = await fetch(`${API_BASE_URL}/routes/${routeId}/stops`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<RouteStopSummary>(response);
  },

  async getMyDriverRoute(filters: { routeDate?: string; status?: string } = {}): Promise<DriverRouteMeResponse> {
    if (USE_MOCK) return mockApi.getMyDriverRoute(filters);
    const params = new URLSearchParams();
    if (filters.routeDate) params.set('route_date', filters.routeDate);
    if (filters.status) params.set('status', filters.status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/driver/me/route${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return json.data ?? { route: null, stops: [] };
  },

  async getQualitySnapshots(filters: {
    scopeType?: 'driver' | 'subcontractor' | 'route';
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<QualitySnapshot[]> {
    if (USE_MOCK) return mockApi.getQualitySnapshots(filters);
    const params = new URLSearchParams();
    if (filters.scopeType) params.set('scope_type', filters.scopeType);
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<QualitySnapshot>(response);
  },

  async getQualityTopRoutesUnderThreshold(filters: {
    threshold?: number;
    limit?: number;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<QualityTopRoutesResult> {
    if (USE_MOCK) return mockApi.getQualityTopRoutesUnderThreshold(filters) as Promise<QualityTopRoutesResult>;
    const params = new URLSearchParams();
    if (filters.threshold !== undefined) params.set('threshold', String(filters.threshold));
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/top-routes-under-threshold${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return {
      data: json.data ?? [],
      meta: json.meta ?? { threshold: filters.threshold ?? 95, count: 0 },
    };
  },

  async getQualityRiskSummary(filters: {
    threshold?: number;
    groupBy?: 'hub' | 'subcontractor';
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<QualityRiskSummaryResult> {
    if (USE_MOCK) return mockApi.getQualityRiskSummary(filters) as Promise<QualityRiskSummaryResult>;
    const params = new URLSearchParams();
    if (filters.threshold !== undefined) params.set('threshold', String(filters.threshold));
    if (filters.groupBy) params.set('group_by', filters.groupBy);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/risk-summary${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return {
      data: json.data ?? [],
      meta: json.meta ?? { threshold: filters.threshold ?? 95, group_by: filters.groupBy ?? 'hub' },
    };
  },

  async exportQualityCsv(filters: {
    scopeType?: 'driver' | 'subcontractor' | 'route';
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityCsv(filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.scopeType) params.set('scope_type', filters.scopeType);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'quality_export.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportQualityPdf(filters: {
    threshold?: number;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityPdf(filters) as Promise<void>;
    const params = new URLSearchParams();
    params.set('scope_type', 'route');
    if (filters.threshold !== undefined) params.set('threshold', String(filters.threshold));
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/export.pdf${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'quality_routes_export.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async getIncidents(): Promise<IncidentSummary[]> {
    if (USE_MOCK) return mockApi.getIncidents();
    const response = await fetch(`${API_BASE_URL}/incidents`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<IncidentSummary>(response);
  },

  async createIncident(payload: {
    incidentable_type: 'shipment' | 'pickup';
    incidentable_id: string;
    catalog_code: string;
    category: 'failed' | 'absent' | 'retry' | 'general';
    notes?: string;
  }): Promise<IncidentSummary> {
    if (USE_MOCK) return mockApi.createIncident(payload);

    const response = await fetch(`${API_BASE_URL}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data.data as IncidentSummary;
  },

  async getIncidentCatalog(): Promise<IncidentCatalogItem[]> {
    if (USE_MOCK) return mockApi.getIncidentCatalog() as Promise<IncidentCatalogItem[]>;

    const response = await fetch(`${API_BASE_URL}/incidents/catalog`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const data = await response.json();
    return data.data?.items ?? [];
  },

  async getTariffs(): Promise<TariffSummary[]> {
    if (USE_MOCK) return mockApi.getTariffs();
    const response = await fetch(`${API_BASE_URL}/tariffs`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<TariffSummary>(response);
  },

  async createTariff(payload: {
    service_type: 'delivery' | 'pickup_normal' | 'pickup_return';
    amount_cents: number;
    currency: string;
    valid_from: string;
    subcontractor_id?: string;
  }): Promise<{ id: string }> {
    if (USE_MOCK) return mockApi.createTariff(payload) as Promise<{ id: string }>;

    const response = await fetch(`${API_BASE_URL}/tariffs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return { id: data.data?.id as string };
  },

  async updateTariff(
    tariffId: string,
    payload: { amount_cents: number; valid_from?: string; is_active?: boolean }
  ): Promise<void> {
    if (USE_MOCK) return mockApi.updateTariff(tariffId, payload) as Promise<void>;

    await fetch(`${API_BASE_URL}/tariffs/${tariffId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  },

  async getSettlementPreview(payload: { subcontractorId: string; period: string }): Promise<SettlementPreview> {
    if (USE_MOCK) return mockApi.getSettlementPreview(payload);

    const params = new URLSearchParams({
      subcontractor_id: payload.subcontractorId,
      period: payload.period,
    });

    const response = await fetch(`${API_BASE_URL}/settlements/preview?${params.toString()}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const data = await response.json();
    return data.data as SettlementPreview;
  },

  async finalizeSettlement(payload: { subcontractorId: string; period: string }): Promise<{ id: string }> {
    if (USE_MOCK) {
      return { id: 'st-mock-1' };
    }

    const response = await fetch(`${API_BASE_URL}/settlements/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify({
        subcontractor_id: payload.subcontractorId,
        period: payload.period,
      }),
    });

    const data = await response.json();
    return { id: data.data?.settlement?.id as string };
  },

  async approveSettlement(settlementId: string): Promise<void> {
    if (USE_MOCK) return;

    await fetch(`${API_BASE_URL}/settlements/${settlementId}/approve`, {
      method: 'POST',
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
  },

  async previewSettlementRecalculate(
    settlementId: string,
    payload: { manual_adjustments?: Array<{ amount_cents: number; reason: string }> } = {}
  ): Promise<SettlementRecalculatePreview> {
    if (USE_MOCK) {
      return mockApi.previewSettlementRecalculate(settlementId, payload) as Promise<SettlementRecalculatePreview>;
    }

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}/preview-recalculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data.data as SettlementRecalculatePreview;
  },

  async recalculateSettlement(settlementId: string): Promise<void> {
    if (USE_MOCK) return mockApi.recalculateSettlement(settlementId) as Promise<void>;

    await fetch(`${API_BASE_URL}/settlements/${settlementId}/recalculate`, {
      method: 'POST',
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
  },

  async exportSettlementCsv(settlementId: string): Promise<void> {
    if (USE_MOCK) return;

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}/export.csv`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `settlement_${settlementId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportSettlementPdf(settlementId: string): Promise<void> {
    if (USE_MOCK) return mockApi.exportSettlementPdf(settlementId) as Promise<void>;

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}/export.pdf`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `settlement_${settlementId}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async markSettlementPaid(settlementId: string): Promise<void> {
    if (USE_MOCK) return;

    await fetch(`${API_BASE_URL}/settlements/${settlementId}/mark-paid`, {
      method: 'POST',
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
  },

  async getSettlements(filters: {
    status?: string;
    period?: string;
    subcontractorId?: string;
    page?: number;
    perPage?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
  }): Promise<PaginatedResult<SettlementSummary>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;
    if (USE_MOCK) {
      return paginateLocal(await mockApi.getSettlements(filters), page, perPage);
    }

    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.period) params.set('period', filters.period);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.dir) params.set('dir', filters.dir);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/settlements${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parsePaginatedData<SettlementSummary>(response);
  },

  async getSettlementDetail(settlementId: string): Promise<SettlementDetail> {
    if (USE_MOCK) return mockApi.getSettlementDetail(settlementId) as Promise<SettlementDetail>;

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const data = await response.json();
    return data.data as SettlementDetail;
  },

  async getSettlementAdjustments(settlementId: string): Promise<SettlementAdjustment[]> {
    if (USE_MOCK) return mockApi.getSettlementAdjustments(settlementId) as Promise<SettlementAdjustment[]>;

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}/adjustments`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<SettlementAdjustment>(response);
  },

  async getSettlementReconciliationReasons(): Promise<SettlementReconciliationReason[]> {
    if (USE_MOCK) return mockApi.getSettlementReconciliationReasons() as Promise<SettlementReconciliationReason[]>;

    const response = await fetch(`${API_BASE_URL}/settlements/reconciliation-reasons`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<SettlementReconciliationReason>(response);
  },

  async getSettlementReconciliationSummary(filters: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
  } = {}): Promise<SettlementReconciliationSummaryRow[]> {
    if (USE_MOCK) return mockApi.getSettlementReconciliationSummary(filters) as Promise<SettlementReconciliationSummaryRow[]>;

    const params = new URLSearchParams();
    if (filters.period) params.set('period', filters.period);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.settlementId) params.set('settlement_id', filters.settlementId);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/settlements/reconciliation-summary${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<SettlementReconciliationSummaryRow>(response);
  },

  async createSettlementAdjustment(
    settlementId: string,
    payload: { amount_cents: number; reason: string }
  ): Promise<{ id: string }> {
    if (USE_MOCK) return mockApi.createSettlementAdjustment(settlementId, payload) as Promise<{ id: string }>;

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}/adjustments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return { id: data.data?.id as string };
  },

  async updateSettlementAdjustment(
    settlementId: string,
    adjustmentId: string,
    payload: { amount_cents?: number; reason?: string }
  ): Promise<void> {
    if (USE_MOCK) return mockApi.updateSettlementAdjustment(settlementId, adjustmentId, payload) as Promise<void>;

    await fetch(`${API_BASE_URL}/settlements/${settlementId}/adjustments/${adjustmentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  },

  async approveSettlementAdjustment(settlementId: string, adjustmentId: string): Promise<void> {
    if (USE_MOCK) return mockApi.approveSettlementAdjustment(settlementId, adjustmentId) as Promise<void>;

    await fetch(`${API_BASE_URL}/settlements/${settlementId}/adjustments/${adjustmentId}/approve`, {
      method: 'POST',
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
  },

  async rejectSettlementAdjustment(settlementId: string, adjustmentId: string, reason: string): Promise<void> {
    if (USE_MOCK) return mockApi.rejectSettlementAdjustment(settlementId, adjustmentId, reason) as Promise<void>;

    await fetch(`${API_BASE_URL}/settlements/${settlementId}/adjustments/${adjustmentId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify({ reason }),
    });
  },

  async reconcileSettlementLine(
    settlementId: string,
    lineId: string,
    payload: { status: 'payable' | 'excluded'; exclusion_code?: string | null }
  ): Promise<void> {
    if (USE_MOCK) return mockApi.reconcileSettlementLine(settlementId, lineId, payload) as Promise<void>;

    await fetch(`${API_BASE_URL}/settlements/${settlementId}/lines/${lineId}/reconcile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  },

  async reconcileSettlementLinesBulk(
    settlementId: string,
    payload: {
      status: 'payable' | 'excluded';
      exclusion_code?: string | null;
      line_type?: 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment';
      current_status?: 'payable' | 'excluded';
      route_id?: string;
      subcontractor_id?: string;
      line_ids?: string[];
    }
  ): Promise<{ affected_count: number }> {
    if (USE_MOCK) return mockApi.reconcileSettlementLinesBulk(settlementId, payload) as Promise<{ affected_count: number }>;

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}/lines/reconcile-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return { affected_count: data.data?.affected_count ?? 0 };
  },

  async previewReconcileSettlementLinesBulk(
    settlementId: string,
    payload: {
      status: 'payable' | 'excluded';
      exclusion_code?: string | null;
      line_type?: 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment';
      current_status?: 'payable' | 'excluded';
      route_id?: string;
      subcontractor_id?: string;
      line_ids?: string[];
    }
  ): Promise<SettlementBulkReconcilePreview> {
    if (USE_MOCK) return mockApi.previewReconcileSettlementLinesBulk(settlementId, payload) as Promise<SettlementBulkReconcilePreview>;

    const response = await fetch(`${API_BASE_URL}/settlements/${settlementId}/lines/reconcile-bulk/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data.data as SettlementBulkReconcilePreview;
  },

  async getSubcontractors(filters: { q?: string; limit?: number } = {}): Promise<SubcontractorSummary[]> {
    if (USE_MOCK) return mockApi.getSubcontractors(filters) as Promise<SubcontractorSummary[]>;

    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.limit) params.set('limit', String(filters.limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/subcontractors${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    return parseData<SubcontractorSummary>(response);
  },

  async getAdvances(filters: {
    subcontractorId?: string;
    status?: string;
    period?: string;
    page?: number;
    perPage?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
  }): Promise<PaginatedResult<AdvanceSummary>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;
    if (USE_MOCK) {
      return paginateLocal(await mockApi.getAdvances(filters), page, perPage);
    }

    const params = new URLSearchParams();
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.status) params.set('status', filters.status);
    if (filters.period) params.set('period', filters.period);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.dir) params.set('dir', filters.dir);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/advances${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parsePaginatedData<AdvanceSummary>(response);
  },

  async createAdvance(payload: {
    subcontractor_id: string;
    amount_cents: number;
    currency: string;
    request_date: string;
    reason?: string;
  }): Promise<{ id: string }> {
    if (USE_MOCK) return mockApi.createAdvance(payload) as Promise<{ id: string }>;

    const response = await fetch(`${API_BASE_URL}/advances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return { id: data.data?.id as string };
  },

  async updateAdvance(
    advanceId: string,
    payload: { amount_cents?: number; request_date?: string; reason?: string }
  ): Promise<void> {
    if (USE_MOCK) return mockApi.updateAdvance(advanceId, payload) as Promise<void>;

    await fetch(`${API_BASE_URL}/advances/${advanceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  },

  async approveAdvance(advanceId: string): Promise<void> {
    if (USE_MOCK) return mockApi.approveAdvance(advanceId) as Promise<void>;

    await fetch(`${API_BASE_URL}/advances/${advanceId}/approve`, {
      method: 'POST',
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
  },

  async exportAdvancesCsv(filters: { subcontractorId?: string; status?: string; period?: string }): Promise<void> {
    if (USE_MOCK) return mockApi.exportAdvancesCsv(filters) as Promise<void>;

    const params = new URLSearchParams();
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.status) params.set('status', filters.status);
    if (filters.period) params.set('period', filters.period);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/advances/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'advances_export.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },
};
