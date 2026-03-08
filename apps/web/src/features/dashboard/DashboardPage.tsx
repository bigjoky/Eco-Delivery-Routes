import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import type { DashboardOverview, HubSummary, SubcontractorSummary } from '../../core/api/types';
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
  recent: { routes: [], shipments: [], incidents: [] },
  productivity_by_hub: [],
  productivity_by_route: [],
  alerts: [],
};

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

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview>(initialOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [hubId, setHubId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.getDashboardOverview({
        period,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
      });
      setOverview(data);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, [period, hubId, subcontractorId]);

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
            Estado operativo global entre {overview.period.from || '-'} y {overview.period.to || '-'}.
          </p>
        </div>
        <div className="dashboard-controls">
          <select
            className="select"
            value={period}
            onChange={(event) => setPeriod(event.target.value as 'today' | '7d' | '30d')}
          >
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
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
          <Button type="button" onClick={load} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar'}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => apiClient.exportDashboardOverviewCsv({
              period,
              hubId: hubId || undefined,
              subcontractorId: subcontractorId || undefined,
            })}
          >
            Exportar CSV
          </Button>
        </div>
      </header>

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

      <div className="page-grid four">
        <Card>
          <CardHeader>
            <CardDescription>Envíos</CardDescription>
            <CardTitle>{overview.totals.shipments}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="helper">Created: {overview.shipments_by_status.created}</div>
            <div className="helper">Out: {overview.shipments_by_status.out_for_delivery}</div>
            <div className="helper">Delivered: {overview.shipments_by_status.delivered}</div>
            <TrendBars values={shipmentTrendValues} max={maxShipmentTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Rutas</CardDescription>
            <CardTitle>{overview.totals.routes}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="helper">Planned: {overview.routes_by_status.planned}</div>
            <div className="helper">In progress: {overview.routes_by_status.in_progress}</div>
            <div className="helper">Completed: {overview.routes_by_status.completed}</div>
            <TrendBars values={routeTrendValues} max={maxRouteTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Incidencias abiertas</CardDescription>
            <CardTitle>{overview.totals.incidents_open}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="helper" to="/incidents?resolved=open">Ver incidencias abiertas</Link>
            <TrendBars values={incidentTrendValues} max={maxIncidentTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Calidad por ruta</CardDescription>
            <CardTitle>{overview.quality.route_avg.toFixed(2)}%</CardTitle>
          </CardHeader>
          <CardContent>
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
        <CardContent className="inline-actions">
          <Link to="/incidents?sla=on_track" className="kpi-item">
            <div className="kpi-label">On Track</div>
            <div className="kpi-value">{overview.sla.on_track}</div>
          </Link>
          <Link to="/incidents?sla=at_risk" className="kpi-item">
            <div className="kpi-label">At Risk</div>
            <div className="kpi-value">{overview.sla.at_risk}</div>
          </Link>
          <Link to="/incidents?sla=breached" className="kpi-item">
            <div className="kpi-label">Breached</div>
            <div className="kpi-value">{overview.sla.breached}</div>
          </Link>
          <Link to="/incidents?resolved=resolved" className="kpi-item">
            <div className="kpi-label">Resolved</div>
            <div className="kpi-value">{overview.sla.resolved}</div>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acciones rápidas</CardTitle>
        </CardHeader>
        <CardContent className="inline-actions">
          <Link to="/shipments" className="btn btn-outline">Envíos</Link>
          <Link to="/routes" className="btn btn-outline">Rutas</Link>
          <Link to="/incidents" className="btn btn-outline">Incidencias</Link>
          <Link to="/quality" className="btn btn-outline">KPI Calidad</Link>
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
            <TableWrapper>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productividad por ruta</CardTitle>
            <CardDescription>Control de ejecución de paradas.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
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
          </CardContent>
        </Card>
      </div>

      <div className="page-grid two">
        <Card>
          <CardHeader><CardTitle>Rutas recientes</CardTitle></CardHeader>
          <CardContent>
            <TableWrapper>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Envíos recientes</CardTitle></CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recent.shipments.length === 0 && <TableRow><TableCell colSpan={3}>Sin envíos</TableCell></TableRow>}
                  {overview.recent.shipments.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Link to={`/shipments/${item.id}`}>{item.reference}</Link></TableCell>
                      <TableCell>{item.consignee_name ?? '-'}</TableCell>
                      <TableCell>{item.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
