import {
  AuditLogEntry,
  AdvanceSummary,
  CurrentUserProfile,
  HubSummary,
  IncidentCatalogItem,
  IncidentSummary,
  LoginResponse,
  PaginatedResult,
  QualitySnapshot,
  QualityRiskSummaryResult,
  QualityDriverBreakdown,
  QualityRouteBreakdown,
  QualitySubcontractorBreakdown,
  QualityThresholdConfig,
  QualityThresholdAlertSettings,
  QualityThresholdAlertSummary,
  QualityThresholdHistoryEntry,
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
  SettlementReconciliationTrendRow,
  SettlementRecalculatePreview,
  SubcontractorSummary,
  ShipmentSummary,
  TariffSummary,
  UserSummary,
  DriverRouteMeResponse,
  PodSummary,
  TrackingEventSummary,
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
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff' | 'quality_threshold';
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
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff' | 'quality_threshold';
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

  async getHubs(filters: { onlyActive?: boolean } = {}): Promise<HubSummary[]> {
    if (USE_MOCK) return mockApi.getHubs(filters) as Promise<HubSummary[]>;

    const params = new URLSearchParams();
    if (filters.onlyActive !== undefined) params.set('only_active', filters.onlyActive ? '1' : '0');
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/hubs${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<HubSummary>(response);
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

  async registerScan(payload: {
    trackable_type: 'shipment' | 'pickup';
    trackable_id: string;
    event_code?: string;
    scan_code: string;
    occurred_at?: string;
  }): Promise<TrackingEventSummary> {
    const body = {
      trackable_type: payload.trackable_type,
      trackable_id: payload.trackable_id,
      event_code: payload.event_code ?? 'SCAN',
      scan_code: payload.scan_code,
      occurred_at: payload.occurred_at ?? new Date().toISOString(),
    };
    if (USE_MOCK) return mockApi.registerScan(body) as Promise<TrackingEventSummary>;
    const response = await fetch(`${API_BASE_URL}/tracking-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return json.data as TrackingEventSummary;
  },

  async registerPod(payload: {
    evidenceable_type: 'shipment' | 'pickup';
    evidenceable_id: string;
    signature_name: string;
  }): Promise<PodSummary> {
    if (USE_MOCK) return mockApi.registerPod(payload) as Promise<PodSummary>;
    const response = await fetch(`${API_BASE_URL}/pods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    return json.data as PodSummary;
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
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<QualityTopRoutesResult> {
    if (USE_MOCK) return mockApi.getQualityTopRoutesUnderThreshold(filters) as Promise<QualityTopRoutesResult>;
    const params = new URLSearchParams();
    if (filters.threshold !== undefined) params.set('threshold', String(filters.threshold));
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
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
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<QualityRiskSummaryResult> {
    if (USE_MOCK) return mockApi.getQualityRiskSummary(filters) as Promise<QualityRiskSummaryResult>;
    const params = new URLSearchParams();
    if (filters.threshold !== undefined) params.set('threshold', String(filters.threshold));
    if (filters.groupBy) params.set('group_by', filters.groupBy);
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
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
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityCsv(filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.scopeType) params.set('scope_type', filters.scopeType);
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
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
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityPdf(filters) as Promise<void>;
    const params = new URLSearchParams();
    params.set('scope_type', 'route');
    if (filters.threshold !== undefined) params.set('threshold', String(filters.threshold));
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
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

  async getQualityRouteBreakdown(routeId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}): Promise<QualityRouteBreakdown> {
    if (USE_MOCK) return mockApi.getQualityRouteBreakdown(routeId, filters) as Promise<QualityRouteBreakdown>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/routes/${routeId}/breakdown${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return json.data as QualityRouteBreakdown;
  },

  async exportQualityRouteBreakdownCsv(routeId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityRouteBreakdownCsv(routeId, filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/routes/${routeId}/breakdown/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quality_route_${routeId}_breakdown.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportQualityRouteBreakdownPdf(routeId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityRouteBreakdownPdf(routeId, filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/routes/${routeId}/breakdown/export.pdf${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quality_route_${routeId}_breakdown.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async getQualityDriverBreakdown(driverId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
    hubId?: string;
    subcontractorId?: string;
  } = {}): Promise<QualityDriverBreakdown> {
    if (USE_MOCK) return mockApi.getQualityDriverBreakdown(driverId, filters) as Promise<QualityDriverBreakdown>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/drivers/${driverId}/breakdown${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return json.data as QualityDriverBreakdown;
  },

  async exportQualityDriverBreakdownCsv(driverId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
    hubId?: string;
    subcontractorId?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityDriverBreakdownCsv(driverId, filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/drivers/${driverId}/breakdown/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quality_driver_${driverId}_breakdown.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportQualityDriverBreakdownPdf(driverId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
    hubId?: string;
    subcontractorId?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityDriverBreakdownPdf(driverId, filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/drivers/${driverId}/breakdown/export.pdf${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quality_driver_${driverId}_breakdown.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async getQualitySubcontractorBreakdown(subcontractorId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}): Promise<QualitySubcontractorBreakdown> {
    if (USE_MOCK) {
      return mockApi.getQualitySubcontractorBreakdown(subcontractorId, filters) as Promise<QualitySubcontractorBreakdown>;
    }
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/subcontractors/${subcontractorId}/breakdown${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return json.data as QualitySubcontractorBreakdown;
  },

  async exportQualitySubcontractorBreakdownCsv(subcontractorId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualitySubcontractorBreakdownCsv(subcontractorId, filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/subcontractors/${subcontractorId}/breakdown/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quality_subcontractor_${subcontractorId}_breakdown.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportQualitySubcontractorBreakdownPdf(subcontractorId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualitySubcontractorBreakdownPdf(subcontractorId, filters) as Promise<void>;
    const params = new URLSearchParams();
    if (filters.periodStart) params.set('period_start', filters.periodStart);
    if (filters.periodEnd) params.set('period_end', filters.periodEnd);
    if (filters.granularity) params.set('granularity', filters.granularity);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/kpis/quality/subcontractors/${subcontractorId}/breakdown/export.pdf${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quality_subcontractor_${subcontractorId}_breakdown.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async getQualityThreshold(): Promise<QualityThresholdConfig> {
    if (USE_MOCK) {
      return { threshold: 95, source_type: 'default', source_id: null, can_manage: true };
    }
    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return json.data as QualityThresholdConfig;
  },

  async setQualityThreshold(payload: {
    threshold: number;
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
  }): Promise<QualityThresholdConfig> {
    if (USE_MOCK) {
      return {
        threshold: payload.threshold,
        source_type: payload.scopeType ?? 'user',
        source_id: payload.scopeId ?? null,
        can_manage: true,
      };
    }
    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify({
        threshold: payload.threshold,
        scope_type: payload.scopeType,
        scope_id: payload.scopeId,
      }),
    });
    const json = await response.json();
    return json.data as QualityThresholdConfig;
  },

  async getQualityThresholdAlertSettings(): Promise<QualityThresholdAlertSettings> {
    if (USE_MOCK) {
      return { large_delta_threshold: 5, window_hours: 24, can_manage: true, source_type: 'default' };
    }
    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold/alert-settings`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return json.data as QualityThresholdAlertSettings;
  },

  async setQualityThresholdAlertSettings(payload: {
    largeDeltaThreshold: number;
    windowHours: number;
  }): Promise<QualityThresholdAlertSettings> {
    if (USE_MOCK) {
      return {
        large_delta_threshold: payload.largeDeltaThreshold,
        window_hours: payload.windowHours,
        can_manage: true,
        source_type: 'configured',
      };
    }
    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold/alert-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify({
        large_delta_threshold: payload.largeDeltaThreshold,
        window_hours: payload.windowHours,
      }),
    });
    const json = await response.json();
    return json.data as QualityThresholdAlertSettings;
  },

  async getQualityThresholdHistory(filters: {
    event?: string;
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  } = {}): Promise<PaginatedResult<QualityThresholdHistoryEntry>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    if (USE_MOCK) {
      return paginateLocal(await mockApi.getQualityThresholdHistory(filters), page, perPage);
    }

    const params = new URLSearchParams();
    if (filters.event) params.set('event', filters.event);
    if (filters.scopeType) params.set('scope_type', filters.scopeType);
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold/history?${params.toString()}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parsePaginatedData<QualityThresholdHistoryEntry>(response);
  },

  async getQualityThresholdAlertSummary(filters: {
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<QualityThresholdAlertSummary> {
    if (USE_MOCK) {
      const history = await mockApi.getQualityThresholdHistory({ event: 'quality.threshold.alert.large_delta' });
      return {
        event: 'quality.threshold.alert.large_delta',
        count: history.filter((row) => row.event === 'quality.threshold.alert.large_delta').length,
        last_event_at: history.find((row) => row.event === 'quality.threshold.alert.large_delta')?.created_at ?? null,
        window_hours: 24,
        large_delta_threshold: 5,
        date_from: '2026-02-27',
        date_to: '2026-02-28',
      };
    }

    const params = new URLSearchParams();
    if (filters.scopeType) params.set('scope_type', filters.scopeType);
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold/history/alerts/summary${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const json = await response.json();
    return json.data as QualityThresholdAlertSummary;
  },

  async exportQualityThresholdHistoryCsv(filters: {
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityThresholdHistoryCsv(filters) as Promise<void>;

    const params = new URLSearchParams();
    if (filters.scopeType) params.set('scope_type', filters.scopeType);
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold/history/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'quality_threshold_history.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportQualityThresholdHistoryPdf(filters: {
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportQualityThresholdHistoryPdf(filters) as Promise<void>;

    const params = new URLSearchParams();
    if (filters.scopeType) params.set('scope_type', filters.scopeType);
    if (filters.scopeId) params.set('scope_id', filters.scopeId);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/kpis/quality/threshold/history/export.pdf${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'quality_threshold_history.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async getIncidents(filters: {
    incidentableType?: 'shipment' | 'pickup';
    incidentableId?: string;
    category?: 'failed' | 'absent' | 'retry' | 'general';
    catalogCode?: string;
    resolved?: 'open' | 'resolved';
    page?: number;
    perPage?: number;
  } = {}): Promise<PaginatedResult<IncidentSummary>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    if (USE_MOCK) {
      return paginateLocal(await mockApi.getIncidents(filters), page, perPage);
    }
    const params = new URLSearchParams();
    if (filters.incidentableType) params.set('incidentable_type', filters.incidentableType);
    if (filters.incidentableId) params.set('incidentable_id', filters.incidentableId);
    if (filters.category) params.set('category', filters.category);
    if (filters.catalogCode) params.set('catalog_code', filters.catalogCode);
    if (filters.resolved) params.set('resolved', filters.resolved);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    const response = await fetch(`${API_BASE_URL}/incidents?${params.toString()}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parsePaginatedData<IncidentSummary>(response);
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

  async resolveIncident(id: string, notes?: string): Promise<IncidentSummary> {
    if (USE_MOCK) return mockApi.resolveIncident(id, notes) as Promise<IncidentSummary>;
    const response = await fetch(`${API_BASE_URL}/incidents/${id}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {}),
      },
      body: JSON.stringify({ notes }),
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
    hubId?: string;
  } = {}): Promise<SettlementReconciliationSummaryRow[]> {
    if (USE_MOCK) return mockApi.getSettlementReconciliationSummary(filters) as Promise<SettlementReconciliationSummaryRow[]>;

    const params = new URLSearchParams();
    if (filters.period) params.set('period', filters.period);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.settlementId) params.set('settlement_id', filters.settlementId);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/settlements/reconciliation-summary${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<SettlementReconciliationSummaryRow>(response);
  },

  async getSettlementReconciliationTrends(filters: {
    granularity?: 'week' | 'month';
    limit?: number;
    period?: string;
    subcontractorId?: string;
    hubId?: string;
  } = {}): Promise<SettlementReconciliationTrendRow[]> {
    if (USE_MOCK) return mockApi.getSettlementReconciliationTrends(filters) as Promise<SettlementReconciliationTrendRow[]>;

    const params = new URLSearchParams();
    if (filters.granularity) params.set('granularity', filters.granularity);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.period) params.set('period', filters.period);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/settlements/reconciliation-trends${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    return parseData<SettlementReconciliationTrendRow>(response);
  },

  async exportSettlementReconciliationSummaryCsv(filters: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportSettlementReconciliationSummaryCsv(filters) as Promise<void>;

    const params = new URLSearchParams();
    if (filters.period) params.set('period', filters.period);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.settlementId) params.set('settlement_id', filters.settlementId);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/settlements/reconciliation-summary/export.csv${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'settlement_reconciliation_summary.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportSettlementReconciliationSummaryPdf(filters: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  } = {}): Promise<void> {
    if (USE_MOCK) return mockApi.exportSettlementReconciliationSummaryPdf(filters) as Promise<void>;

    const params = new URLSearchParams();
    if (filters.period) params.set('period', filters.period);
    if (filters.subcontractorId) params.set('subcontractor_id', filters.subcontractorId);
    if (filters.settlementId) params.set('settlement_id', filters.settlementId);
    if (filters.hubId) params.set('hub_id', filters.hubId);
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/settlements/reconciliation-summary/export.pdf${suffix}`, {
      headers: sessionStore.getToken() ? { Authorization: `Bearer ${sessionStore.getToken()}` } : {},
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'settlement_reconciliation_summary.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
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
