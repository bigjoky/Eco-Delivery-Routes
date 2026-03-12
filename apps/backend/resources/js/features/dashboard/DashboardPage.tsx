import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ExportActionsModal } from '../../components/common/ExportActionsModal';
import InstallPwaButton from '../../components/InstallPwaButton';
import { sessionStore } from '../../core/auth/sessionStore';
import { hasExportAccess } from '../../core/auth/exportAccess';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import type { AuditLogEntry, DashboardOverview, HubSummary, SubcontractorSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

const initialOverview: DashboardOverview = {
  period: { from: '', to: '', preset: '7d' },
  filters: { hub_id: null, subcontractor_id: null },
  totals: { shipments: 0, routes: 0, incidents_open: 0, quality_threshold: 95 },
  shipments_by_status: { created: 0, out_for_delivery: 0, delivered: 0, incident: 0 },
  routes_by_status: { planned: 0, in_progress: 0, completed: 0 },
  quality: { route_avg: 0, driver_avg: 0, below_threshold_routes: 0 },
  trends: { shipments: [], routes: [], incidents: [], quality: [] },
  sla: { on_track: 0, at_risk: 0, breached: 0, resolved: 0 },
  recent: { routes: [], shipments: [], expeditions: [], incidents: [] },
  productivity_by_hub: [],
  productivity_by_route: [],
  alerts: [],
};

export function buildDashboardRangeQuery(from: string, to: string, mode: 'routes' | 'expeditions' | 'incidents'): string {
  if (!from || !to) return '';
  if (mode === 'expeditions') {
    return `scheduled_from=${encodeURIComponent(from)}&scheduled_to=${encodeURIComponent(to)}`;
  }
  return `date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`;
}

function TrendBars({ values, max }: { values: number[]; max: number }) {
  return (
    <div className="trend-bars">
      {values.map((value, index) => {
        const height = max > 0 ? Math.max(8, Math.round((value / max) * 56)) : 8;
        return <span key={index} className="trend-bar" style={{ height }} title={String(value)} />;
      })}
    </div>
  );
}

function scoreVariant(score: number, threshold: number): 'success' | 'warning' | 'destructive' {
  if (score >= threshold) return 'success';
  if (score >= threshold - 5) return 'warning';
  return 'destructive';
}

function alertVariant(severity: 'high' | 'medium' | 'low'): 'destructive' | 'warning' | 'secondary' {
  if (severity === 'high') return 'destructive';
  if (severity === 'medium') return 'warning';
  return 'secondary';
}

type DashboardBulkAuditItem = {
  key: 'expeditions' | 'routes' | 'incidents' | 'partners' | 'settlements' | 'quality';
  label: string;
  href: string;
  row: AuditLogEntry | null;
};

function parseAuditDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('es-ES');
}

function getAuditActor(row: AuditLogEntry | null): string {
  if (!row) return '-';
  return row.actor_name ?? row.actor_user_id ?? 'sistema';
}

export function getAuditRangeDates(range: '24h' | '7d' | '30d'): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now);
  if (range === '24h') {
    from.setDate(now.getDate() - 1);
  } else if (range === '7d') {
    from.setDate(now.getDate() - 7);
  } else {
    from.setDate(now.getDate() - 30);
  }

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

function pickLatestAudit(rows: Array<AuditLogEntry | null>): AuditLogEntry | null {
  return rows
    .filter((row): row is AuditLogEntry => row !== null)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null;
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview>(initialOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const canExport = hasExportAccess('dashboard', sessionStore.getRoles());
  const [hubId, setHubId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [bulkAuditRange, setBulkAuditRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [bulkAuditSummary, setBulkAuditSummary] = useState<DashboardBulkAuditItem[]>([]);

  const fetchLatestAuditByEvent = useCallback(async (
    eventPrefix: string,
    range: '24h' | '7d' | '30d'
  ): Promise<AuditLogEntry | null> => {
    const { dateFrom, dateTo } = getAuditRangeDates(range);
    try {
      const response = await apiClient.getAuditLogs({
        event: eventPrefix,
        dateFrom,
        dateTo,
        page: 1,
        perPage: 1,
      });
      return response.data[0] ?? null;
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        data,
        shipmentsBulk,
        routesBulk,
        incidentsResolvedBulk,
        incidentsSlaBulk,
        partnersSubcontractors,
        partnersDrivers,
        partnersVehicles,
        settlementsBulk,
        qualityUpdated,
        qualityAlerts,
      ] = await Promise.all([
        apiClient.getDashboardOverview({
          period,
          hubId: hubId || undefined,
          subcontractorId: subcontractorId || undefined,
        }),
        fetchLatestAuditByEvent('shipments.bulk_updated', bulkAuditRange),
        fetchLatestAuditByEvent('route.stops.bulk_', bulkAuditRange),
        fetchLatestAuditByEvent('incidents.resolved.bulk', bulkAuditRange),
        fetchLatestAuditByEvent('incidents.sla_overridden.bulk', bulkAuditRange),
        fetchLatestAuditByEvent('subcontractors.bulk_status_updated', bulkAuditRange),
        fetchLatestAuditByEvent('drivers.bulk_status_updated', bulkAuditRange),
        fetchLatestAuditByEvent('vehicles.bulk_status_updated', bulkAuditRange),
        fetchLatestAuditByEvent('settlement.', bulkAuditRange),
        fetchLatestAuditByEvent('quality.threshold.updated', bulkAuditRange),
        fetchLatestAuditByEvent('quality.threshold.alert_settings.updated', bulkAuditRange),
      ]);
      setOverview(data);
      const partnerLatest = pickLatestAudit([partnersSubcontractors, partnersDrivers, partnersVehicles]);
      const incidentsLatest = pickLatestAudit([incidentsResolvedBulk, incidentsSlaBulk]);
      const qualityLatest = pickLatestAudit([qualityUpdated, qualityAlerts]);

      setBulkAuditSummary([
        { key: 'expeditions', label: 'Expediciones', href: '/expeditions', row: shipmentsBulk },
        { key: 'routes', label: 'Rutas', href: '/routes', row: routesBulk },
        { key: 'incidents', label: 'Incidencias', href: '/incidents', row: incidentsLatest },
        { key: 'partners', label: 'Partners', href: '/partners', row: partnerLatest },
        { key: 'settlements', label: 'Liquidaciones', href: '/settlements', row: settlementsBulk },
        { key: 'quality', label: 'Calidad', href: '/quality', row: qualityLatest },
      ]);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, [period, hubId, subcontractorId, fetchLatestAuditByEvent, bulkAuditRange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => load(), 60000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, load]);

  const routeQualityVariant = useMemo(
    () => scoreVariant(overview.quality.route_avg, overview.totals.quality_threshold),
    [overview.quality.route_avg, overview.totals.quality_threshold]
  );
  const shipmentTrendValues = overview.trends.shipments.map((row) => row.total);
  const routeTrendValues = overview.trends.routes.map((row) => row.total);
  const incidentTrendValues = overview.trends.incidents.map((row) => row.open);
  const qualityTrendValues = overview.trends.quality.map((row) => row.route_avg);
  const maxShipmentTrend = Math.max(1, ...shipmentTrendValues);
  const maxRouteTrend = Math.max(1, ...routeTrendValues);
  const maxIncidentTrend = Math.max(1, ...incidentTrendValues);
  const maxQualityTrend = Math.max(1, ...qualityTrendValues);
  const sharedRangeQuery = useMemo(
    () => buildDashboardRangeQuery(overview.period.from, overview.period.to, 'routes'),
    [overview.period.from, overview.period.to]
  );
  const shipmentRangeQuery = useMemo(
    () => buildDashboardRangeQuery(overview.period.from, overview.period.to, 'expeditions'),
    [overview.period.from, overview.period.to]
  );

  useEffect(() => {
    apiClient.getHubs({ onlyActive: true }).then(setHubs).catch(() => setHubs([]));
    apiClient.getSubcontractors({ limit: 100 }).then(setSubcontractors).catch(() => setSubcontractors([]));
  }, []);

  return (
    <section className="page-grid dashboard-shell">
      <header className="dashboard-header">
        <div>
          <h1 className="page-title">Everything at a glance</h1>
          <p className="page-subtitle">
            Estado operativo global de expediciones, rutas, incidencias y calidad entre {overview.period.from || '-'} y {overview.period.to || '-'}.
          </p>
        </div>
        <div className="dashboard-controls">
          <InstallPwaButton />
          <select
            className="select"
            value={period}
            onChange={(event) => setPeriod(event.target.value as 'today' | '7d' | '30d')}
          >
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
          <Button type="button" variant="outline" onClick={() => setShowFilters((value) => !value)}>
            {showFilters ? 'Ocultar filtros' : 'Filtros'}
          </Button>
          <Button type="button" onClick={load} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar'}</Button>
          <ExportActionsModal
            title="Exportar dashboard"
            triggerDisabled={!canExport}
            actions={[
              {
                id: 'dashboard-csv',
                label: 'CSV',
                description: 'Resumen dashboard en formato CSV.',
                run: () => apiClient.exportDashboardOverviewCsv({
                  period,
                  hubId: hubId || undefined,
                  subcontractorId: subcontractorId || undefined,
                }),
              },
              {
                id: 'dashboard-pdf',
                label: 'PDF',
                description: 'Resumen dashboard en formato PDF.',
                run: () => apiClient.exportDashboardOverviewPdf({
                  period,
                  hubId: hubId || undefined,
                  subcontractorId: subcontractorId || undefined,
                }),
              },
            ]}
          />
        </div>
      </header>

      <div className="ops-summary-strip">
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Expediciones</div>
          <div className="ops-summary-value">{overview.totals.shipments}</div>
          <div className="ops-summary-caption">Creadas {overview.shipments_by_status.created} · Entregadas {overview.shipments_by_status.delivered}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Rutas</div>
          <div className="ops-summary-value">{overview.totals.routes}</div>
          <div className="ops-summary-caption">Planificadas {overview.routes_by_status.planned} · En curso {overview.routes_by_status.in_progress}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Incidencias</div>
          <div className="ops-summary-value">{overview.totals.incidents_open}</div>
          <div className="ops-summary-caption">En riesgo {overview.sla.at_risk} · Vencidas {overview.sla.breached}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Calidad ruta</div>
          <div className="ops-summary-value">{overview.quality.route_avg.toFixed(1)}%</div>
          <div className="ops-summary-caption">Umbral {overview.totals.quality_threshold.toFixed(1)}% · Bajo umbral {overview.quality.below_threshold_routes}</div>
        </div>
      </div>

      <div className="ops-summary-strip">
        <Link to="/expeditions" className="ops-summary-chip">
          <div className="ops-summary-label">Operativa</div>
          <div className="ops-summary-value">Expediciones</div>
          <div className="ops-summary-caption">Circuito completo: recogida, entrega y trazabilidad</div>
        </Link>
        <Link to="/routes" className="ops-summary-chip">
          <div className="ops-summary-label">Planificación</div>
          <div className="ops-summary-value">Rutas</div>
          <div className="ops-summary-caption">Asignación, seguimiento y cierre</div>
        </Link>
        <Link to="/incidents" className="ops-summary-chip">
          <div className="ops-summary-label">Control</div>
          <div className="ops-summary-value">Incidencias</div>
          <div className="ops-summary-caption">SLA, resolución y priorización</div>
        </Link>
        <Link to="/quality" className="ops-summary-chip">
          <div className="ops-summary-label">Seguimiento</div>
          <div className="ops-summary-value">Calidad</div>
          <div className="ops-summary-caption">Rutas bajo umbral y riesgo operativo</div>
        </Link>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros de visualización</CardTitle>
            <CardDescription>Acota por hub/subcontrata y comportamiento de auto-refresh.</CardDescription>
          </CardHeader>
          <CardContent className="dashboard-filters-grid">
            <select className="select" value={hubId} onChange={(event) => setHubId(event.target.value)}>
              <option value="">Todos los hubs</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code} · {hub.name}</option>
              ))}
            </select>
            <select className="select" value={subcontractorId} onChange={(event) => setSubcontractorId(event.target.value)}>
              <option value="">Todas las subcontratas</option>
              {subcontractors.map((partner) => (
                <option key={partner.id} value={partner.id}>{partner.legal_name}</option>
              ))}
            </select>
            <select
              className="select"
              value={autoRefresh ? 'on' : 'off'}
              onChange={(event) => setAutoRefresh(event.target.value === 'on')}
            >
              <option value="on">Auto-refresh 60s</option>
              <option value="off">Sin auto-refresh</option>
            </select>
            <Button type="button" variant="outline" onClick={() => { setHubId(''); setSubcontractorId(''); }}>
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      )}

      {overview.alerts.length > 0 && (
        <div className="dashboard-alert-grid">
          {overview.alerts.map((alert) => (
            <Link key={alert.id} className="dashboard-alert-card" to={alert.href}>
              <div className="dashboard-alert-top">
                <Badge variant={alertVariant(alert.severity)}>{alert.severity.toUpperCase()}</Badge>
                <span className="dashboard-alert-count">{alert.count}</span>
              </div>
              <div className="dashboard-alert-title">{alert.title}</div>
              <div className="helper">{alert.message}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="page-grid four dashboard-kpi-grid">
        <Card className="dashboard-kpi-card">
          <CardHeader>
            <CardDescription>Expediciones</CardDescription>
            <CardTitle>{overview.totals.shipments}</CardTitle>
          </CardHeader>
          <CardContent className="dashboard-kpi-content">
            <Link className="helper" to={`/expeditions?leg_status=created${shipmentRangeQuery ? `&${shipmentRangeQuery}` : ''}`}>Creadas: {overview.shipments_by_status.created}</Link>
            <Link className="helper" to={`/expeditions?leg_status=out_for_delivery${shipmentRangeQuery ? `&${shipmentRangeQuery}` : ''}`}>En reparto: {overview.shipments_by_status.out_for_delivery}</Link>
            <Link className="helper" to={`/expeditions?leg_status=delivered${shipmentRangeQuery ? `&${shipmentRangeQuery}` : ''}`}>Entregadas: {overview.shipments_by_status.delivered}</Link>
            <TrendBars values={shipmentTrendValues} max={maxShipmentTrend} />
          </CardContent>
        </Card>
        <Card className="dashboard-kpi-card">
          <CardHeader>
            <CardDescription>Rutas</CardDescription>
            <CardTitle>{overview.totals.routes}</CardTitle>
          </CardHeader>
          <CardContent className="dashboard-kpi-content">
            <Link className="helper" to={`/routes?status=planned${sharedRangeQuery ? `&${sharedRangeQuery}` : ''}`}>Planned: {overview.routes_by_status.planned}</Link>
            <Link className="helper" to={`/routes?status=in_progress${sharedRangeQuery ? `&${sharedRangeQuery}` : ''}`}>En curso: {overview.routes_by_status.in_progress}</Link>
            <Link className="helper" to={`/routes?status=completed${sharedRangeQuery ? `&${sharedRangeQuery}` : ''}`}>Completadas: {overview.routes_by_status.completed}</Link>
            <TrendBars values={routeTrendValues} max={maxRouteTrend} />
          </CardContent>
        </Card>
        <Card className="dashboard-kpi-card">
          <CardHeader>
            <CardDescription>Incidencias abiertas</CardDescription>
            <CardTitle>{overview.totals.incidents_open}</CardTitle>
          </CardHeader>
          <CardContent className="dashboard-kpi-content">
            <Link className="helper" to={`/incidents?resolved=open${sharedRangeQuery ? `&${sharedRangeQuery}` : ''}`}>Ver incidencias abiertas</Link>
            <TrendBars values={incidentTrendValues} max={maxIncidentTrend} />
          </CardContent>
        </Card>
        <Card className="dashboard-kpi-card">
          <CardHeader>
            <CardDescription>Calidad por ruta</CardDescription>
            <CardTitle>{overview.quality.route_avg.toFixed(2)}%</CardTitle>
          </CardHeader>
          <CardContent className="dashboard-kpi-content">
            <Badge variant={routeQualityVariant}>Umbral {overview.totals.quality_threshold.toFixed(2)}%</Badge>
            <div className="helper">Rutas bajo umbral: {overview.quality.below_threshold_routes}</div>
            <TrendBars values={qualityTrendValues} max={maxQualityTrend} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SLA incidencias</CardTitle>
          <CardDescription>Estado operativo de cumplimiento SLA en el periodo.</CardDescription>
        </CardHeader>
        <CardContent className="dashboard-sla-row">
          <Link to="/incidents?sla=on_track" className="kpi-item dashboard-sla-item">
            <div className="kpi-label">On Track</div>
            <div className="kpi-value">{overview.sla.on_track}</div>
          </Link>
          <Link to="/incidents?sla=at_risk" className="kpi-item dashboard-sla-item">
            <div className="kpi-label">At Risk</div>
            <div className="kpi-value">{overview.sla.at_risk}</div>
          </Link>
          <Link to="/incidents?sla=breached" className="kpi-item dashboard-sla-item">
            <div className="kpi-label">Breached</div>
            <div className="kpi-value">{overview.sla.breached}</div>
          </Link>
          <Link to="/incidents?resolved=resolved" className="kpi-item dashboard-sla-item">
            <div className="kpi-label">Resolved</div>
            <div className="kpi-value">{overview.sla.resolved}</div>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Última acción masiva por módulo</CardTitle>
          <CardDescription>Trazabilidad rápida desde auditoría operativa.</CardDescription>
        </CardHeader>
        <CardContent className="dashboard-bulk-audit-grid">
          <div className="dashboard-bulk-audit-toolbar">
            <span className="helper">Ventana</span>
            <Button type="button" variant={bulkAuditRange === '24h' ? 'secondary' : 'outline'} onClick={() => setBulkAuditRange('24h')}>
              24h
            </Button>
            <Button type="button" variant={bulkAuditRange === '7d' ? 'secondary' : 'outline'} onClick={() => setBulkAuditRange('7d')}>
              7d
            </Button>
            <Button type="button" variant={bulkAuditRange === '30d' ? 'secondary' : 'outline'} onClick={() => setBulkAuditRange('30d')}>
              30d
            </Button>
          </div>
          {bulkAuditSummary.map((item) => (
            <Link key={item.key} to={item.href} className="kpi-item dashboard-bulk-audit-item">
              <div className="kpi-label">{item.label}</div>
              <div className="helper">{item.row?.event ?? 'Sin acciones recientes'}</div>
              <div className="helper">Actor: {getAuditActor(item.row)}</div>
              <div className="helper">Fecha: {parseAuditDate(item.row?.created_at)}</div>
            </Link>
          ))}
          {bulkAuditSummary.length === 0 && (
            <div className="helper">Sin datos de auditoría masiva para mostrar.</div>
          )}
        </CardContent>
      </Card>

      {error && <p className="helper error">{error}</p>}

      <div className="page-grid two">
        <Card>
          <CardHeader>
            <CardTitle>Productividad por hub</CardTitle>
            <CardDescription>Completadas vs planificadas por paradas.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper className="desktop-table-only">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hub</TableHead>
                    <TableHead>Rutas</TableHead>
                    <TableHead>Paradas</TableHead>
                    <TableHead>Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.productivity_by_hub.length === 0 && (
                    <TableRow><TableCell colSpan={4}>Sin datos</TableCell></TableRow>
                  )}
                  {overview.productivity_by_hub.map((row) => (
                    <TableRow key={row.hub_id}>
                      <TableCell>
                        <Link to={`/routes?hub_id=${encodeURIComponent(row.hub_id)}&date_from=${encodeURIComponent(overview.period.from)}&date_to=${encodeURIComponent(overview.period.to)}`}>
                          {row.hub_code} · {row.hub_name}
                        </Link>
                      </TableCell>
                      <TableCell>{row.routes_completed}/{row.routes_total}</TableCell>
                      <TableCell>{row.completed_stops}/{row.planned_stops}</TableCell>
                      <TableCell>{row.completion_ratio.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
            <div className="mobile-ops-list">
              {overview.productivity_by_hub.map((row) => (
                <article key={`hub-mobile-${row.hub_id}`} className="mobile-ops-card">
                  <div className="mobile-ops-card-header">
                    <div>
                      <Link to={`/routes?hub_id=${encodeURIComponent(row.hub_id)}&date_from=${encodeURIComponent(overview.period.from)}&date_to=${encodeURIComponent(overview.period.to)}`}>
                        {row.hub_code} · {row.hub_name}
                      </Link>
                      <div className="helper">Rutas {row.routes_completed}/{row.routes_total}</div>
                    </div>
                    <Badge variant="secondary">{row.completion_ratio.toFixed(2)}%</Badge>
                  </div>
                  <div className="mobile-ops-card-grid">
                    <div>
                      <div className="kpi-label">Paradas</div>
                      <div>{row.completed_stops}/{row.planned_stops}</div>
                    </div>
                  </div>
                  <div className="mobile-ops-card-actions">
                    <Link
                      to={`/routes?hub_id=${encodeURIComponent(row.hub_id)}&date_from=${encodeURIComponent(overview.period.from)}&date_to=${encodeURIComponent(overview.period.to)}`}
                      className="btn btn-outline"
                    >
                      Ver rutas
                    </Link>
                  </div>
                </article>
              ))}
              {overview.productivity_by_hub.length === 0 ? <div className="mobile-ops-empty">Sin datos</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productividad por ruta</CardTitle>
            <CardDescription>Control de ejecución de paradas.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper className="desktop-table-only">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Paradas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.productivity_by_route.length === 0 && (
                    <TableRow><TableCell colSpan={4}>Sin datos</TableCell></TableRow>
                  )}
                  {overview.productivity_by_route.map((row) => (
                    <TableRow key={row.route_id}>
                      <TableCell>
                        <Link to={`/routes/${row.route_id}`}>{row.route_code}</Link>
                        <div>
                          <Link className="helper" to={`/routes?q=${encodeURIComponent(row.route_code)}&date_from=${encodeURIComponent(overview.period.from)}&date_to=${encodeURIComponent(overview.period.to)}`}>
                            Ver en listado
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>{row.route_date}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.completed_stops}/{row.planned_stops} ({row.completion_ratio.toFixed(2)}%)</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
            <div className="mobile-ops-list">
              {overview.productivity_by_route.map((row) => (
                <article key={`route-mobile-${row.route_id}`} className="mobile-ops-card">
                  <div className="mobile-ops-card-header">
                    <div>
                      <Link to={`/routes/${row.route_id}`}>{row.route_code}</Link>
                      <div className="helper">{row.route_date}</div>
                    </div>
                    <Badge variant="secondary">{row.status}</Badge>
                  </div>
                  <div className="mobile-ops-card-grid">
                    <div>
                      <div className="kpi-label">Paradas</div>
                      <div>{row.completed_stops}/{row.planned_stops}</div>
                    </div>
                    <div>
                      <div className="kpi-label">Ratio</div>
                      <div>{row.completion_ratio.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div className="mobile-ops-card-actions">
                    <Link to={`/routes/${row.route_id}`} className="btn btn-outline">Abrir</Link>
                    <Link className="btn btn-outline" to={`/routes?q=${encodeURIComponent(row.route_code)}&date_from=${encodeURIComponent(overview.period.from)}&date_to=${encodeURIComponent(overview.period.to)}`}>
                      Listado
                    </Link>
                  </div>
                </article>
              ))}
              {overview.productivity_by_route.length === 0 ? <div className="mobile-ops-empty">Sin datos</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="page-grid two">
        <Card>
          <CardHeader><CardTitle>Rutas recientes</CardTitle></CardHeader>
          <CardContent>
            <TableWrapper className="desktop-table-only">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recent.routes.length === 0 && <TableRow><TableCell colSpan={3}>Sin rutas</TableCell></TableRow>}
                  {overview.recent.routes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Link to={`/routes/${item.id}`}>{item.code}</Link></TableCell>
                      <TableCell>{item.route_date}</TableCell>
                      <TableCell>{item.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
            <div className="mobile-ops-list">
              {overview.recent.routes.map((item) => (
                <article key={`recent-route-${item.id}`} className="mobile-ops-card">
                  <div className="mobile-ops-card-header">
                    <Link to={`/routes/${item.id}`}>{item.code}</Link>
                    <Badge variant="secondary">{item.status}</Badge>
                  </div>
                  <div className="helper">{item.route_date}</div>
                  <div className="mobile-ops-card-actions">
                    <Link to={`/routes/${item.id}`} className="btn btn-outline">Abrir</Link>
                    <Link to={`/routes?q=${encodeURIComponent(item.code)}`} className="btn btn-outline">Listado</Link>
                  </div>
                </article>
              ))}
              {overview.recent.routes.length === 0 ? <div className="mobile-ops-empty">Sin rutas</div> : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expediciones recientes</CardTitle></CardHeader>
          <CardContent>
            <TableWrapper className="desktop-table-only">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Estado de entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview.recent.expeditions ?? []).length === 0 && <TableRow><TableCell colSpan={3}>Sin expediciones</TableCell></TableRow>}
                  {(overview.recent.expeditions ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Link to={`/expeditions?q=${encodeURIComponent(item.reference)}`}>{item.reference}</Link></TableCell>
                      <TableCell>{item.recipient_name ?? '-'}</TableCell>
                      <TableCell>{item.shipment_status ?? item.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
            <div className="mobile-ops-list">
              {(overview.recent.expeditions ?? []).map((item) => (
                <article key={`recent-expedition-${item.id}`} className="mobile-ops-card">
                  <div className="mobile-ops-card-header">
                    <Link to={`/expeditions?q=${encodeURIComponent(item.reference)}`}>{item.reference}</Link>
                    <Badge variant="secondary">{item.shipment_status ?? item.status}</Badge>
                  </div>
                  <div className="helper">{item.recipient_name ?? '-'} · {item.pickup_reference ?? 'Sin recogida'} {'->'} {item.shipment_reference ?? 'Sin entrega'}</div>
                  <div className="mobile-ops-card-actions">
                    <Link to={`/expeditions?q=${encodeURIComponent(item.reference)}`} className="btn btn-outline">Ver expedición</Link>
                    <Link to={`/expeditions?leg_status=${encodeURIComponent(item.shipment_status ?? item.status)}`} className="btn btn-outline">Mismo estado</Link>
                  </div>
                </article>
              ))}
              {(overview.recent.expeditions ?? []).length === 0 ? <div className="mobile-ops-empty">Sin expediciones</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Incidencias recientes</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Catálogo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.recent.incidents.length === 0 && <TableRow><TableCell colSpan={4}>Sin incidencias</TableCell></TableRow>}
                {overview.recent.incidents.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><Link to={`/incidents?q=${encodeURIComponent(item.id)}`}>{item.id}</Link></TableCell>
                    <TableCell>{item.catalog_code}</TableCell>
                    <TableCell>{item.shipment_reference ?? item.incidentable_id}</TableCell>
                    <TableCell>{item.sla_status ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {overview.recent.incidents.map((item) => (
              <article key={`recent-incident-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <Link to={`/incidents?q=${encodeURIComponent(item.id)}`}>{item.id}</Link>
                  <Badge variant={alertVariant(item.sla_status === 'breached' ? 'high' : item.sla_status === 'at_risk' ? 'medium' : 'low')}>
                    {item.sla_status ?? 'open'}
                  </Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Catálogo</div>
                    <div>{item.catalog_code}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Referencia</div>
                    <div>{item.shipment_reference ?? item.incidentable_id}</div>
                  </div>
                </div>
                <div className="mobile-ops-card-actions">
                  <Link to={`/incidents?q=${encodeURIComponent(item.id)}`} className="btn btn-outline">Abrir</Link>
                  {item.shipment_reference ? (
                    <Link to={`/expeditions?q=${encodeURIComponent(item.shipment_reference)}`} className="btn btn-outline">Ver expedición</Link>
                  ) : null}
                </div>
              </article>
            ))}
            {overview.recent.incidents.length === 0 ? <div className="mobile-ops-empty">Sin incidencias</div> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
