import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { HubSummary, QualityDriverBreakdown, QualityRiskSummaryRow, QualityRouteBreakdown, QualitySnapshot, QualitySubcontractorBreakdown, QualityThresholdAlertSummary, QualityThresholdAlertTopScope, QualityThresholdHistoryEntry, RoleSummary, SubcontractorSummary, UserSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { chartColorByRatio, normalizeChartWidth } from './breakdownChart';
import { severityFromScore, severityLabel } from './risk';

export function QualityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<QualitySnapshot[]>([]);
  const [scopeType, setScopeType] = useState<'all' | 'driver' | 'route' | 'subcontractor'>('all');
  const [scopeId, setScopeId] = useState('');
  const [hubId, setHubId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [threshold, setThreshold] = useState('95');
  const [underThresholdRoutes, setUnderThresholdRoutes] = useState<QualitySnapshot[]>([]);
  const [riskGroupBy, setRiskGroupBy] = useState<'hub' | 'subcontractor'>('hub');
  const [riskSummary, setRiskSummary] = useState<QualityRiskSummaryRow[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedSubcontractorBreakdownId, setSelectedSubcontractorBreakdownId] = useState('');
  const [routeBreakdown, setRouteBreakdown] = useState<QualityRouteBreakdown | null>(null);
  const [driverBreakdown, setDriverBreakdown] = useState<QualityDriverBreakdown | null>(null);
  const [subcontractorBreakdown, setSubcontractorBreakdown] = useState<QualitySubcontractorBreakdown | null>(null);
  const [breakdownGranularity, setBreakdownGranularity] = useState<'week' | 'month'>('month');
  const [canManageThreshold, setCanManageThreshold] = useState(false);
  const [thresholdSource, setThresholdSource] = useState<'default' | 'global' | 'role' | 'user'>('default');
  const [thresholdScopeType, setThresholdScopeType] = useState<'global' | 'role' | 'user'>('user');
  const [thresholdScopeId, setThresholdScopeId] = useState('');
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [thresholdSaveMessage, setThresholdSaveMessage] = useState('');
  const [thresholdAlertDeltaText, setThresholdAlertDeltaText] = useState('5');
  const [thresholdAlertWindowText, setThresholdAlertWindowText] = useState('24');
  const [thresholdAlertSaveMessage, setThresholdAlertSaveMessage] = useState('');
  const [thresholdAuditRows, setThresholdAuditRows] = useState<QualityThresholdHistoryEntry[]>([]);
  const [thresholdAlertSummary, setThresholdAlertSummary] = useState<QualityThresholdAlertSummary | null>(null);
  const [thresholdAlertRows, setThresholdAlertRows] = useState<QualityThresholdHistoryEntry[]>([]);
  const [thresholdAlertTopScopes, setThresholdAlertTopScopes] = useState<QualityThresholdAlertTopScope[]>([]);
  const [qualityLoadError, setQualityLoadError] = useState(false);
  const [alertScopeType, setAlertScopeType] = useState<'all' | 'global' | 'role' | 'user'>(() => {
    const raw = searchParams.get('alert_scope_type');
    return raw === 'global' || raw === 'role' || raw === 'user' ? raw : 'all';
  });
  const [alertScopeId, setAlertScopeId] = useState<string>(() => searchParams.get('alert_scope_id') ?? '');
  const [thresholdAlertPage, setThresholdAlertPage] = useState<number>(() => {
    const parsed = Number(searchParams.get('alert_page') ?? '1');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [thresholdAlertLastPage, setThresholdAlertLastPage] = useState(1);
  const [displayTimeZone, setDisplayTimeZone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
  );
  const thresholdNumber = Number.isFinite(Number(threshold)) ? Number(threshold) : 95;

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (alertScopeType === 'all') next.delete('alert_scope_type');
      else next.set('alert_scope_type', alertScopeType);
      if (alertScopeId) next.set('alert_scope_id', alertScopeId);
      else next.delete('alert_scope_id');
      next.set('alert_page', String(thresholdAlertPage));
      return next;
    }, { replace: true });
  }, [alertScopeType, alertScopeId, thresholdAlertPage, setSearchParams]);

  useEffect(() => {
    apiClient.getSubcontractors({ limit: 20 }).then(setSubcontractors);
    apiClient.getHubs({ onlyActive: true }).then(setHubs);
    apiClient.getRoles().then(setRoles).catch(() => setRoles([]));
    apiClient.getUsers().then(setUsers).catch(() => setUsers([]));
    apiClient.getQualityThreshold().then((config) => {
      setThreshold(String(config.threshold));
      setCanManageThreshold(Boolean(config.can_manage));
      setThresholdSource(config.source_type);
    });
    apiClient.getQualityThresholdAlertSettings().then((config) => {
      setThresholdAlertDeltaText(String(config.large_delta_threshold));
      setThresholdAlertWindowText(String(config.window_hours));
      if (typeof config.can_manage === 'boolean') {
        setCanManageThreshold((current) => current && config.can_manage);
      }
    });
    apiClient
      .getQualityThresholdHistory({
        scopeType: thresholdScopeType,
        scopeId: thresholdScopeType === 'global' ? undefined : (thresholdScopeId || undefined),
        page: 1,
        perPage: 20,
      })
      .then((response) => setThresholdAuditRows(response.data))
      .catch(() => setThresholdAuditRows([]));
    apiClient
      .getQualityThresholdAlertSummary({
        scopeType: alertScopeType === 'all' ? undefined : alertScopeType,
        scopeId: alertScopeType === 'all' || alertScopeType === 'global' ? undefined : (alertScopeId || undefined),
        dateFrom: periodStart || undefined,
        dateTo: periodEnd || undefined,
      })
      .then(setThresholdAlertSummary)
      .catch(() => setThresholdAlertSummary(null));
    apiClient
      .getQualityThresholdAlertTopScopes({
        scopeType: alertScopeType === 'all' ? undefined : alertScopeType,
        scopeId: alertScopeType === 'all' || alertScopeType === 'global' ? undefined : (alertScopeId || undefined),
        dateFrom: periodStart || undefined,
        dateTo: periodEnd || undefined,
        limit: 5,
      })
      .then(setThresholdAlertTopScopes)
      .catch(() => setThresholdAlertTopScopes([]));
  }, [thresholdScopeType, thresholdScopeId, alertScopeType, alertScopeId, periodStart, periodEnd]);

  useEffect(() => {
    apiClient
      .getQualityThresholdHistory({
        event: 'quality.threshold.alert.large_delta',
        scopeType: alertScopeType === 'all' ? undefined : alertScopeType,
        scopeId: alertScopeType === 'all' || alertScopeType === 'global' ? undefined : (alertScopeId || undefined),
        dateFrom: periodStart || undefined,
        dateTo: periodEnd || undefined,
        page: thresholdAlertPage,
        perPage: 10,
      })
      .then((response) => {
        setThresholdAlertRows(response.data);
        setThresholdAlertLastPage(Math.max(1, response.meta.last_page));
      })
      .catch(() => {
        setThresholdAlertRows([]);
        setThresholdAlertLastPage(1);
      });
  }, [alertScopeType, alertScopeId, periodStart, periodEnd, thresholdAlertPage]);

  useEffect(() => {
    apiClient
      .getQualitySnapshots({
        scopeType: scopeType === 'all' ? undefined : scopeType,
        scopeId: scopeId || undefined,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then((rows) => {
        setItems(rows);
        setQualityLoadError(false);
      })
      .catch(() => {
        setItems([]);
        setQualityLoadError(true);
      });
  }, [scopeType, scopeId, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    apiClient
      .getQualityTopRoutesUnderThreshold({
        threshold: thresholdNumber,
        limit: 10,
        scopeId: scopeType === 'route' ? scopeId || undefined : undefined,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then((result) => setUnderThresholdRoutes(result.data))
      .catch(() => {
        setUnderThresholdRoutes([]);
        setQualityLoadError(true);
      });
  }, [thresholdNumber, scopeType, scopeId, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    apiClient
      .getQualityRiskSummary({
        threshold: thresholdNumber,
        groupBy: riskGroupBy,
        scopeId: scopeType === 'route' ? scopeId || undefined : undefined,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then((result) => setRiskSummary(result.data))
      .catch(() => {
        setRiskSummary([]);
        setQualityLoadError(true);
      });
  }, [thresholdNumber, riskGroupBy, scopeType, scopeId, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    if (!selectedRouteId) {
      setRouteBreakdown(null);
      return;
    }
    apiClient
      .getQualityRouteBreakdown(selectedRouteId, {
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        granularity: breakdownGranularity,
      })
      .then(setRouteBreakdown)
      .catch(() => {
        setRouteBreakdown(null);
        setQualityLoadError(true);
      });
  }, [selectedRouteId, periodStart, periodEnd, breakdownGranularity]);

  useEffect(() => {
    if (!selectedDriverId) {
      setDriverBreakdown(null);
      return;
    }
    apiClient
      .getQualityDriverBreakdown(selectedDriverId, {
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        granularity: breakdownGranularity,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
      })
      .then(setDriverBreakdown)
      .catch(() => {
        setDriverBreakdown(null);
        setQualityLoadError(true);
      });
  }, [selectedDriverId, periodStart, periodEnd, breakdownGranularity, hubId, subcontractorId]);

  useEffect(() => {
    if (!selectedSubcontractorBreakdownId) {
      setSubcontractorBreakdown(null);
      return;
    }
    apiClient
      .getQualitySubcontractorBreakdown(selectedSubcontractorBreakdownId, {
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        granularity: breakdownGranularity,
      })
      .then(setSubcontractorBreakdown)
      .catch(() => {
        setSubcontractorBreakdown(null);
        setQualityLoadError(true);
      });
  }, [selectedSubcontractorBreakdownId, periodStart, periodEnd, breakdownGranularity]);

  const avg = useMemo(() => {
    if (items.length === 0) return 0;
    return items.reduce((acc, item) => acc + item.service_quality_score, 0) / items.length;
  }, [items]);

  const comparisonDelta = useMemo(() => {
    if (!routeBreakdown || !driverBreakdown) return null;
    const scoreDelta = Number((routeBreakdown.service_quality_score - driverBreakdown.service_quality_score).toFixed(2));
    const completionDelta = routeBreakdown.components.completed_total - driverBreakdown.components.completed_total;
    return { scoreDelta, completionDelta };
  }, [routeBreakdown, driverBreakdown]);

  const alerts = useMemo(() => items.filter((item) => item.service_quality_score < thresholdNumber), [items, thresholdNumber]);
  const latestLargeDeltaAlert = thresholdAlertRows[0] ?? null;

  if (qualityLoadError) {
    return (
      <section className="page-grid">
        <Card>
          <CardHeader>
            <CardTitle className="page-title">KPI Calidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="helper">No se han podido cargar los KPIs. Reintenta en unos segundos.</div>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  function applyQuickRange(days: 7 | 30) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
    setPeriodStart(toIsoDate(start));
    setPeriodEnd(toIsoDate(end));
  }

  function clearRange() {
    setPeriodStart('');
    setPeriodEnd('');
  }

  function parseAuditMetadata(metadata: QualityThresholdHistoryEntry['metadata']): Record<string, unknown> {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return metadata as Record<string, unknown>;
  }

  const thresholdScopeIdRequired = thresholdScopeType === 'role';
  const disableThresholdSave =
    !canManageThreshold ||
    !Number.isFinite(Number(threshold)) ||
    Number(threshold) < 0 ||
    Number(threshold) > 100 ||
    (thresholdScopeIdRequired && !thresholdScopeId);
  const disableThresholdAlertSave =
    !canManageThreshold ||
    !Number.isFinite(Number(thresholdAlertDeltaText)) ||
    Number(thresholdAlertDeltaText) < 0 ||
    Number(thresholdAlertDeltaText) > 100 ||
    !Number.isFinite(Number(thresholdAlertWindowText)) ||
    Number(thresholdAlertWindowText) < 1 ||
    Number(thresholdAlertWindowText) > 168;

  function thresholdDeltaBadge(beforeThreshold?: number | null, afterThreshold?: number | null) {
    if (beforeThreshold === null || beforeThreshold === undefined || afterThreshold === null || afterThreshold === undefined) {
      return <Badge variant="secondary">N/A</Badge>;
    }
    if (afterThreshold > beforeThreshold) {
      return <Badge variant="success">Sube</Badge>;
    }
    if (afterThreshold < beforeThreshold) {
      return <Badge variant="warning">Baja</Badge>;
    }
    return <Badge variant="secondary">Igual</Badge>;
  }

  function formatAuditTimestamp(raw: string): string {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: displayTimeZone,
    }).format(date);
  }

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Calidad de Servicio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Media KPI</div>
              <div className="kpi-value">{avg.toFixed(2)}%</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Umbral</div>
              <div className="kpi-value">95%</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Snapshots</div>
              <div className="kpi-value">{items.length}</div>
            </div>
          </div>
          <div className="form-row">
            <Select value={scopeType} onChange={(e) => setScopeType(e.target.value as 'all' | 'driver' | 'route' | 'subcontractor')}>
              <option value="all">Todos los scopes</option>
              <option value="driver">Solo conductor</option>
              <option value="route">Solo ruta</option>
              <option value="subcontractor">Solo subcontrata</option>
            </Select>
            <Input
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder={scopeType === 'route' ? 'Filtrar route_id (scope_id)' : 'Filtrar scope_id'}
            />
            <Select value={hubId} onChange={(e) => setHubId(e.target.value)}>
              <option value="">Todos los hubs</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code}</option>
              ))}
            </Select>
            <Select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
              <option value="">Todas las subcontratas</option>
              {subcontractors.map((subcontractor) => (
                <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
              ))}
            </Select>
            <Input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="Desde periodo (YYYY-MM-DD)" />
            <Input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="Hasta periodo (YYYY-MM-DD)" />
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Umbral (ej: 95)" />
            <Select value={thresholdScopeType} onChange={(e) => setThresholdScopeType(e.target.value as 'global' | 'role' | 'user')}>
              <option value="user">Scope usuario</option>
              <option value="role">Scope rol</option>
              <option value="global">Scope global</option>
            </Select>
            {thresholdScopeType === 'role' && (
              <Select value={thresholdScopeId} onChange={(e) => setThresholdScopeId(e.target.value)}>
                <option value="">Selecciona rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.code}>{role.code}</option>
                ))}
              </Select>
            )}
            {thresholdScopeType === 'user' && (
              <Select value={thresholdScopeId} onChange={(e) => setThresholdScopeId(e.target.value)}>
                <option value="">Usuario actual</option>
                {users.slice(0, 100).map((user) => (
                  <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
                ))}
              </Select>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={disableThresholdSave}
              onClick={() =>
                apiClient
                  .setQualityThreshold({
                    threshold: thresholdNumber,
                    scopeType: thresholdScopeType,
                    scopeId: thresholdScopeType === 'global' ? undefined : (thresholdScopeId || undefined),
                  })
                  .then((config) => {
                    setThreshold(String(config.threshold));
                    setThresholdSource(config.source_type);
                    setThresholdSaveMessage(`Umbral guardado (${config.source_type}${config.source_id ? `:${config.source_id}` : ''})`);
                    return apiClient.getQualityThresholdHistory({
                      scopeType: thresholdScopeType,
                      scopeId: thresholdScopeType === 'global' ? undefined : (thresholdScopeId || undefined),
                      page: 1,
                      perPage: 20,
                    });
                  })
                  .then((response) => {
                    if (response) setThresholdAuditRows(response.data);
                  })
                  .then(() =>
                    apiClient.getQualityThresholdAlertSummary({
                      scopeType: alertScopeType === 'all' ? undefined : alertScopeType,
                      scopeId: alertScopeType === 'all' || alertScopeType === 'global' ? undefined : (alertScopeId || undefined),
                      dateFrom: periodStart || undefined,
                      dateTo: periodEnd || undefined,
                    })
                  )
                  .then((summary) => {
                    if (summary) setThresholdAlertSummary(summary);
                    setThresholdAlertPage(1);
                    return apiClient.getQualityThresholdAlertTopScopes({
                      scopeType: alertScopeType === 'all' ? undefined : alertScopeType,
                      scopeId: alertScopeType === 'all' || alertScopeType === 'global' ? undefined : (alertScopeId || undefined),
                      dateFrom: periodStart || undefined,
                      dateTo: periodEnd || undefined,
                      limit: 5,
                    });
                  })
                  .then((rows) => {
                    if (rows) setThresholdAlertTopScopes(rows);
                  })
                  .catch(() => setThresholdSaveMessage('No se pudo guardar el umbral'))
              }
            >
              Guardar umbral
            </Button>
            <Input
              value={thresholdAlertDeltaText}
              onChange={(e) => setThresholdAlertDeltaText(e.target.value)}
              placeholder="Delta alerta (ej: 5)"
            />
            <Input
              value={thresholdAlertWindowText}
              onChange={(e) => setThresholdAlertWindowText(e.target.value)}
              placeholder="Ventana horas (ej: 24)"
            />
            <Button
              type="button"
              variant="outline"
              disabled={disableThresholdAlertSave}
              onClick={() =>
                apiClient
                  .setQualityThresholdAlertSettings({
                    largeDeltaThreshold: Number(thresholdAlertDeltaText),
                    windowHours: Number(thresholdAlertWindowText),
                  })
                  .then((config) => {
                    setThresholdAlertDeltaText(String(config.large_delta_threshold));
                    setThresholdAlertWindowText(String(config.window_hours));
                    setThresholdAlertSaveMessage('Configuración de alerta guardada');
                    return apiClient.getQualityThresholdHistory({
                      scopeType: thresholdScopeType,
                      scopeId: thresholdScopeType === 'global' ? undefined : (thresholdScopeId || undefined),
                      page: 1,
                      perPage: 20,
                    });
                  })
                  .then((response) => {
                    if (response) setThresholdAuditRows(response.data);
                  })
                  .then(() =>
                    apiClient.getQualityThresholdAlertSummary({
                      scopeType: alertScopeType === 'all' ? undefined : alertScopeType,
                      scopeId: alertScopeType === 'all' || alertScopeType === 'global' ? undefined : (alertScopeId || undefined),
                      dateFrom: periodStart || undefined,
                      dateTo: periodEnd || undefined,
                    })
                  )
                  .then((summary) => {
                    if (summary) setThresholdAlertSummary(summary);
                    setThresholdAlertPage(1);
                    return apiClient.getQualityThresholdAlertTopScopes({
                      scopeType: alertScopeType === 'all' ? undefined : alertScopeType,
                      scopeId: alertScopeType === 'all' || alertScopeType === 'global' ? undefined : (alertScopeId || undefined),
                      dateFrom: periodStart || undefined,
                      dateTo: periodEnd || undefined,
                      limit: 5,
                    });
                  })
                  .then((rows) => {
                    if (rows) setThresholdAlertTopScopes(rows);
                  })
                  .catch(() => setThresholdAlertSaveMessage('No se pudo guardar la configuración de alerta'))
              }
            >
              Guardar alerta delta
            </Button>
          </div>
          {thresholdSaveMessage && <p>{thresholdSaveMessage}</p>}
          {thresholdAlertSaveMessage && <p>{thresholdAlertSaveMessage}</p>}
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => applyQuickRange(7)}>Ultimos 7 dias</Button>
            <Button type="button" variant="outline" onClick={() => applyQuickRange(30)}>Ultimos 30 dias</Button>
            <Button type="button" variant="outline" onClick={clearRange}>Limpiar rango</Button>
            <Select value={breakdownGranularity} onChange={(e) => setBreakdownGranularity(e.target.value as 'week' | 'month')}>
              <option value="month">Desglose mensual</option>
              <option value="week">Desglose semanal</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                apiClient.exportQualityCsv({
                  scopeType: scopeType === 'all' ? undefined : scopeType,
                  scopeId: scopeId || undefined,
                  hubId: hubId || undefined,
                  subcontractorId: subcontractorId || undefined,
                  periodStart: periodStart || undefined,
                  periodEnd: periodEnd || undefined,
                })
              }
            >
              Exportar CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                apiClient.exportQualityPdf({
                  threshold: thresholdNumber,
                  scopeId: scopeType === 'route' ? scopeId || undefined : undefined,
                  hubId: hubId || undefined,
                  subcontractorId: subcontractorId || undefined,
                  periodStart: periodStart || undefined,
                  periodEnd: periodEnd || undefined,
                })
              }
            >
              Exportar PDF rutas
            </Button>
            <Badge variant="secondary">Umbral fuente: {thresholdSource}</Badge>
            <Badge variant={alerts.length > 0 ? 'warning' : 'success'}>Alertas activas: {alerts.length}</Badge>
            <Select value={displayTimeZone} onChange={(e) => setDisplayTimeZone(e.target.value)}>
              <option value="Europe/Madrid">Europe/Madrid</option>
              <option value="UTC">UTC</option>
              <option value="Atlantic/Canary">Atlantic/Canary</option>
              <option value="America/New_York">America/New_York</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                apiClient.exportQualityThresholdHistoryCsv({
                  scopeType: thresholdScopeType,
                  scopeId: thresholdScopeType === 'global' ? undefined : (thresholdScopeId || undefined),
                  dateFrom: periodStart || undefined,
                  dateTo: periodEnd || undefined,
                })
              }
            >
              Exportar historial umbral CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                apiClient.exportQualityThresholdHistoryPdf({
                  scopeType: thresholdScopeType,
                  scopeId: thresholdScopeType === 'global' ? undefined : (thresholdScopeId || undefined),
                  dateFrom: periodStart || undefined,
                  dateTo: periodEnd || undefined,
                })
              }
            >
              Exportar historial umbral PDF
            </Button>
          </div>

          {alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Alertas KPI &lt; {thresholdNumber}%</CardTitle>
              </CardHeader>
              <CardContent>
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scope</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Periodo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.slice(0, 20).map((item) => (
                        <TableRow key={`alert-${item.id}`}>
                          <TableCell>{item.scope_type} {item.scope_label ?? item.scope_id}</TableCell>
                          <TableCell><Badge variant="destructive">{item.service_quality_score}%</Badge></TableCell>
                          <TableCell>{item.period_start} - {item.period_end}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              </CardContent>
            </Card>
          )}

          {(thresholdAlertSummary?.count ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Notificaciones internas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="form-row">
                  <Select
                    value={alertScopeType}
                    onChange={(e) => {
                      setAlertScopeType(e.target.value as 'all' | 'global' | 'role' | 'user');
                      setThresholdAlertPage(1);
                    }}
                  >
                    <option value="all">Alertas todos scopes</option>
                    <option value="global">Scope global</option>
                    <option value="role">Scope rol</option>
                    <option value="user">Scope usuario</option>
                  </Select>
                  <Input
                    value={alertScopeId}
                    onChange={(e) => {
                      setAlertScopeId(e.target.value);
                      setThresholdAlertPage(1);
                    }}
                    placeholder={alertScopeType === 'role' ? 'scope_id rol (ej: driver)' : 'scope_id (opcional)'}
                    disabled={alertScopeType === 'all' || alertScopeType === 'global'}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAlertScopeType('all');
                      setAlertScopeId('');
                      setThresholdAlertPage(1);
                    }}
                  >
                    Limpiar filtro alertas
                  </Button>
                </div>
                <p>
                  Alertas por cambio brusco de umbral: <strong>{thresholdAlertSummary?.count ?? 0}</strong> (ventana: {thresholdAlertSummary?.window_hours ?? thresholdAlertWindowText}h)
                </p>
                {latestLargeDeltaAlert && (
                  <p>
                    Ultima alerta: {formatAuditTimestamp(latestLargeDeltaAlert.created_at)} por{' '}
                    {latestLargeDeltaAlert.actor_name ?? latestLargeDeltaAlert.actor_user_id ?? 'sistema'}.
                  </p>
                )}
                {thresholdAlertTopScopes.length > 0 && (
                  <TableWrapper>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Top scope</TableHead>
                          <TableHead>Alertas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {thresholdAlertTopScopes.map((scope) => (
                          <TableRow key={`top-scope-${scope.scope_type}-${scope.scope_id ?? 'null'}`}>
                            <TableCell>{scope.scope_type} · {scope.scope_label ?? scope.scope_id ?? '-'}</TableCell>
                            <TableCell>{scope.alerts_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableWrapper>
                )}
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Actor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {thresholdAlertRows.map((row) => (
                        <TableRow key={`delta-alert-${row.id}`}>
                          <TableCell>{formatAuditTimestamp(row.created_at)}</TableCell>
                          <TableCell>{row.scope_type} · {row.scope_id ?? '-'}</TableCell>
                          <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
                <div className="inline-actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={thresholdAlertPage <= 1}
                    onClick={() => setThresholdAlertPage((current) => Math.max(1, current - 1))}
                  >
                    Anterior
                  </Button>
                  <Badge variant="secondary">Pagina {thresholdAlertPage} / {thresholdAlertLastPage}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={thresholdAlertPage >= thresholdAlertLastPage}
                    onClick={() => setThresholdAlertPage((current) => Math.min(thresholdAlertLastPage, current + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Historial umbrales KPI</CardTitle>
            </CardHeader>
            <CardContent>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Cambio</TableHead>
                      <TableHead>Tendencia</TableHead>
                      <TableHead>Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {thresholdAuditRows.map((row) => {
                      const metadata = parseAuditMetadata(row.metadata);
                      const beforeThreshold = row.before_threshold ?? (metadata.before as { threshold?: number } | undefined)?.threshold;
                      const afterThreshold = row.after_threshold ?? (metadata.after as { threshold?: number } | undefined)?.threshold;
                      const scopeType = String(row.scope_type ?? (metadata.scope_type as string | undefined) ?? '-');
                      const scopeId = String(row.scope_id ?? (metadata.scope_id as string | undefined) ?? '-');

                      return (
                        <TableRow key={`threshold-audit-${row.id}`}>
                          <TableCell>{formatAuditTimestamp(row.created_at)}</TableCell>
                          <TableCell>{scopeType} · {scopeId}</TableCell>
                          <TableCell>
                            {beforeThreshold !== undefined ? `${beforeThreshold}%` : '-'} → {afterThreshold !== undefined ? `${afterThreshold}%` : '-'}
                          </TableCell>
                          <TableCell>
                            {row.event === 'quality.threshold.alert.large_delta'
                              ? <Badge variant="destructive">ALERTA</Badge>
                              : thresholdDeltaBadge(beforeThreshold, afterThreshold)}
                          </TableCell>
                          <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Intentados</TableHead>
                  <TableHead>Completados</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.scope_type} {item.scope_label ?? item.scope_id}</TableCell>
                    <TableCell>{item.period_start} - {item.period_end}</TableCell>
                    <TableCell>
                      <Badge variant={item.service_quality_score >= 95 ? 'success' : 'warning'}>
                        {item.service_quality_score}%
                      </Badge>
                    </TableCell>
                    <TableCell>{item.assigned_with_attempt}</TableCell>
                    <TableCell>{item.delivered_completed + item.pickups_completed}</TableCell>
                    <TableCell>
                      {item.scope_type === 'route' ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedRouteId(item.scope_id)}
                        >
                          Ver detalle ruta
                        </Button>
                      ) : item.scope_type === 'driver' ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedDriverId(item.scope_id)}
                        >
                          Ver detalle conductor
                        </Button>
                      ) : item.scope_type === 'subcontractor' ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedSubcontractorBreakdownId(item.scope_id)}
                        >
                          Ver detalle subcontrata
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          {routeBreakdown && (
            <>
              <h3>Detalle KPI por ruta</h3>
              <div className="inline-actions">
                <Badge variant={routeBreakdown.service_quality_score >= 95 ? 'success' : 'warning'}>
                  {routeBreakdown.service_quality_score}%
                </Badge>
                <span>Ruta: {routeBreakdown.route_code ?? routeBreakdown.route_id}</span>
                <span>Snapshots: {routeBreakdown.snapshots_count}</span>
                <Link to={`/routes/${routeBreakdown.route_id}`}>Abrir ruta</Link>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityRouteBreakdownCsv(routeBreakdown.route_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar CSV desglose
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityRouteBreakdownPdf(routeBreakdown.route_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar PDF desglose
                </Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {routeBreakdown.periods.map((period) => (
                  <div key={period.period_key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{period.period_key}</span>
                      <span>{period.components.completion_ratio}%</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8 }}>
                      <div
                        style={{
                          width: `${normalizeChartWidth(period.components.completion_ratio)}%`,
                          height: '100%',
                          borderRadius: 6,
                          background: chartColorByRatio(period.components.completion_ratio),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Componente</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Asignados con intento</TableCell><TableCell>{routeBreakdown.components.assigned_with_attempt}</TableCell></TableRow>
                    <TableRow><TableCell>Entregas completadas</TableCell><TableCell>{routeBreakdown.components.delivered_completed}</TableCell></TableRow>
                    <TableRow><TableCell>Recogidas completadas</TableCell><TableCell>{routeBreakdown.components.pickups_completed}</TableCell></TableRow>
                    <TableRow><TableCell>Total completados</TableCell><TableCell>{routeBreakdown.components.completed_total}</TableCell></TableRow>
                    <TableRow><TableCell>Fallidas</TableCell><TableCell>{routeBreakdown.components.failed_count}</TableCell></TableRow>
                    <TableRow><TableCell>Ausencias</TableCell><TableCell>{routeBreakdown.components.absent_count}</TableCell></TableRow>
                    <TableRow><TableCell>Reintentos</TableCell><TableCell>{routeBreakdown.components.retry_count}</TableCell></TableRow>
                    <TableRow><TableCell>Ratio completitud</TableCell><TableCell>{routeBreakdown.components.completion_ratio}%</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableWrapper>
            </>
          )}

          {driverBreakdown && (
            <>
              <h3>Detalle KPI por conductor</h3>
              <div className="inline-actions">
                <Badge variant={driverBreakdown.service_quality_score >= 95 ? 'success' : 'warning'}>
                  {driverBreakdown.service_quality_score}%
                </Badge>
                <span>Conductor: {driverBreakdown.driver_code ?? driverBreakdown.driver_id}</span>
                <span>Snapshots: {driverBreakdown.snapshots_count}</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityDriverBreakdownCsv(driverBreakdown.driver_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                      hubId: hubId || undefined,
                      subcontractorId: subcontractorId || undefined,
                    })
                  }
                >
                  Exportar CSV conductor
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityDriverBreakdownPdf(driverBreakdown.driver_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                      hubId: hubId || undefined,
                      subcontractorId: subcontractorId || undefined,
                    })
                  }
                >
                  Exportar PDF conductor
                </Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {driverBreakdown.periods.map((period) => (
                  <div key={`driver-${period.period_key}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{period.period_key}</span>
                      <span>{period.components.completion_ratio}%</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8 }}>
                      <div
                        style={{
                          width: `${normalizeChartWidth(period.components.completion_ratio)}%`,
                          height: '100%',
                          borderRadius: 6,
                          background: chartColorByRatio(period.components.completion_ratio),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {subcontractorBreakdown && (
            <>
              <h3>Detalle KPI por subcontrata</h3>
              <div className="inline-actions">
                <Badge variant={subcontractorBreakdown.service_quality_score >= 95 ? 'success' : 'warning'}>
                  {subcontractorBreakdown.service_quality_score}%
                </Badge>
                <span>Subcontrata: {subcontractorBreakdown.subcontractor_code ?? subcontractorBreakdown.subcontractor_id}</span>
                <span>Snapshots: {subcontractorBreakdown.snapshots_count}</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualitySubcontractorBreakdownCsv(subcontractorBreakdown.subcontractor_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar CSV subcontrata
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualitySubcontractorBreakdownPdf(subcontractorBreakdown.subcontractor_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar PDF subcontrata
                </Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {subcontractorBreakdown.periods.map((period) => (
                  <div key={`subcontractor-${period.period_key}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{period.period_key}</span>
                      <span>{period.components.completion_ratio}%</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8 }}>
                      <div
                        style={{
                          width: `${normalizeChartWidth(period.components.completion_ratio)}%`,
                          height: '100%',
                          borderRadius: 6,
                          background: chartColorByRatio(period.components.completion_ratio),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {comparisonDelta && (
            <Card>
              <CardHeader>
                <CardTitle>Comparativa Ruta vs Conductor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="kpi-grid">
                  <div className="kpi-item">
                    <div className="kpi-label">Delta score</div>
                    <div className="kpi-value">{comparisonDelta.scoreDelta}%</div>
                  </div>
                  <div className="kpi-item">
                    <div className="kpi-label">Delta completados</div>
                    <div className="kpi-value">{comparisonDelta.completionDelta}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <h3>Rutas bajo umbral</h3>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Periodo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {underThresholdRoutes.map((item) => (
                  <TableRow key={`under-${item.id}`}>
                    <TableCell>{item.scope_label ?? item.scope_id}</TableCell>
                    <TableCell>
                      <Badge variant="warning">{item.service_quality_score}%</Badge>
                    </TableCell>
                    <TableCell>{item.period_start} - {item.period_end}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          <h3>Riesgo operativo</h3>
          <div className="form-row">
            <Select value={riskGroupBy} onChange={(e) => setRiskGroupBy(e.target.value as 'hub' | 'subcontractor')}>
              <option value="hub">Agrupar por hub</option>
              <option value="subcontractor">Agrupar por subcontrata</option>
            </Select>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Rutas bajo umbral</TableHead>
                  <TableHead>Ratio</TableHead>
                  <TableHead>Media score</TableHead>
                  <TableHead>Severidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskSummary.map((item) => {
                  const severity = severityFromScore(item.avg_score);
                  return (
                    <TableRow key={`risk-${item.group_id}-${item.group_type}`}>
                      <TableCell>{item.group_label}</TableCell>
                      <TableCell>{item.routes_under_threshold}/{item.routes_count}</TableCell>
                      <TableCell>{item.under_threshold_ratio}%</TableCell>
                      <TableCell>{item.avg_score}%</TableCell>
                      <TableCell>
                        <Badge variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'warning' : 'secondary'}>
                          {severityLabel(severity)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}
