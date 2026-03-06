import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { RouteSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

const REFRESH_INTERVAL_MS = 20_000;

type RouteStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

const STATUS_ORDER: RouteStatus[] = ['planned', 'in_progress', 'completed', 'cancelled'];

export function RoutesBoardPage() {
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [incidentOpenCount, setIncidentOpenCount] = useState(0);
  const [incidentBreachedCount, setIncidentBreachedCount] = useState(0);

  const reload = useCallback(async () => {
    setError('');
    try {
      const [routesResult, incidentOpenResult, incidentBreachedResult] = await Promise.all([
        apiClient.getRoutes({ page: 1, perPage: 200, sort: 'route_date', dir: 'desc', hubId: hubFilter || undefined }),
        apiClient.getIncidents({ resolved: 'open', page: 1, perPage: 1 }),
        apiClient.getIncidents({ resolved: 'open', slaStatus: 'breached', page: 1, perPage: 1 }),
      ]);
      setRoutes(routesResult.data);
      setIncidentOpenCount(incidentOpenResult.meta.total);
      setIncidentBreachedCount(incidentBreachedResult.meta.total);
      setLastRefreshAt(new Date().toISOString());
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : 'No se pudo cargar el tablero operativo');
    } finally {
      setLoading(false);
    }
  }, [hubFilter]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void reload();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const grouped = useMemo(() => {
    const byStatus = new Map<RouteStatus, RouteSummary[]>();
    STATUS_ORDER.forEach((status) => byStatus.set(status, []));
    routes.forEach((item) => {
      const status = (item.status as RouteStatus);
      if (!byStatus.has(status)) return;
      byStatus.get(status)!.push(item);
    });
    return byStatus;
  }, [routes]);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Tablero Operativo de Rutas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <input value={hubFilter} onChange={(event) => setHubFilter(event.target.value)} placeholder="Filtrar por hub_id" />
            <Button type="button" variant="outline" onClick={() => setHubFilter('')}>Limpiar hub</Button>
            <Button type="button" onClick={() => void reload()}>Refrescar ahora</Button>
            <span className="helper">
              {lastRefreshAt ? `Ultima actualización ${new Date(lastRefreshAt).toLocaleTimeString('es-ES')}` : 'Sin actualizaciones'}
            </span>
          </div>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Rutas visibles</div>
              <div className="kpi-value">{routes.length}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Incidencias abiertas</div>
              <div className="kpi-value">{incidentOpenCount}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Incidencias SLA vencido</div>
              <div className="kpi-value">{incidentBreachedCount}</div>
            </div>
          </div>
          {loading ? <div className="helper">Cargando tablero...</div> : null}
          {error ? <div className="helper error">{error}</div> : null}
        </CardContent>
      </Card>

      <div className="page-grid four">
        {STATUS_ORDER.map((status) => {
          const items = grouped.get(status) ?? [];
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle>
                  <span>{status}</span>
                  <Badge variant="secondary" title={`Rutas ${status}`}>{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="page-grid">
                  {items.length === 0 ? <div className="helper">Sin rutas</div> : null}
                  {items.map((item) => (
                    <div key={item.id} className="card-row">
                      <div>
                        <div><Link to={`/routes/${item.id}`}>{item.code}</Link></div>
                        <div className="helper">{item.route_date}</div>
                      </div>
                      <div className="helper">
                        {item.driver_code ?? 'Sin conductor'} · {item.vehicle_code ?? 'Sin vehículo'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

