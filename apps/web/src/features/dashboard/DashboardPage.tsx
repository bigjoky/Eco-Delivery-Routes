import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import type { IncidentSummary, QualitySnapshot, RouteSummary, ShipmentSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

type DashboardData = {
  totals: {
    shipments: number;
    routes: number;
    incidentsOpen: number;
    qualityThreshold: number;
  };
  shipmentsByStatus: {
    created: number;
    outForDelivery: number;
    delivered: number;
    incident: number;
  };
  routesByStatus: {
    planned: number;
    inProgress: number;
    completed: number;
  };
  quality: {
    routeAvg: number;
    driverAvg: number;
    belowThresholdRoutes: number;
  };
  upcomingRoutes: RouteSummary[];
  recentShipments: ShipmentSummary[];
  recentIncidents: IncidentSummary[];
};

const initialData: DashboardData = {
  totals: {
    shipments: 0,
    routes: 0,
    incidentsOpen: 0,
    qualityThreshold: 95,
  },
  shipmentsByStatus: {
    created: 0,
    outForDelivery: 0,
    delivered: 0,
    incident: 0,
  },
  routesByStatus: {
    planned: 0,
    inProgress: 0,
    completed: 0,
  },
  quality: {
    routeAvg: 0,
    driverAvg: 0,
    belowThresholdRoutes: 0,
  },
  upcomingRoutes: [],
  recentShipments: [],
  recentIncidents: [],
};

function averageScore(snapshots: QualitySnapshot[]): number {
  if (snapshots.length === 0) return 0;
  const total = snapshots.reduce((acc, item) => acc + Number(item.service_quality_score || 0), 0);
  return Number((total / snapshots.length).toFixed(2));
}

function scoreVariant(score: number, threshold: number): 'success' | 'warning' | 'destructive' {
  if (score >= threshold) return 'success';
  if (score >= threshold - 5) return 'warning';
  return 'destructive';
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        shipmentsTotal,
        shipmentsCreated,
        shipmentsOut,
        shipmentsDelivered,
        shipmentsIncident,
        recentShipments,
        routesTotal,
        routesPlanned,
        routesInProgress,
        routesCompleted,
        upcomingRoutes,
        incidentsBoard,
        recentIncidents,
        qualityThreshold,
        routeQuality,
        driverQuality,
        underThresholdRoutes,
      ] = await Promise.all([
        apiClient.getShipments({ page: 1, perPage: 1 }),
        apiClient.getShipments({ page: 1, perPage: 1, status: 'created' }),
        apiClient.getShipments({ page: 1, perPage: 1, status: 'out_for_delivery' }),
        apiClient.getShipments({ page: 1, perPage: 1, status: 'delivered' }),
        apiClient.getShipments({ page: 1, perPage: 1, status: 'incident' }),
        apiClient.getShipments({ page: 1, perPage: 5, sort: 'created_at', dir: 'desc' }),
        apiClient.getRoutes({ page: 1, perPage: 1 }),
        apiClient.getRoutes({ page: 1, perPage: 1, status: 'planned' }),
        apiClient.getRoutes({ page: 1, perPage: 1, status: 'in_progress' }),
        apiClient.getRoutes({ page: 1, perPage: 1, status: 'completed' }),
        apiClient.getRoutes({ page: 1, perPage: 5, sort: 'route_date', dir: 'asc' }),
        apiClient.getIncidentsBoard(),
        apiClient.getIncidents({ page: 1, perPage: 5, resolved: 'open' }),
        apiClient.getQualityThreshold(),
        apiClient.getQualitySnapshots({ scopeType: 'route' }),
        apiClient.getQualitySnapshots({ scopeType: 'driver' }),
        apiClient.getQualityTopRoutesUnderThreshold({ limit: 5 }),
      ]);

      setData({
        totals: {
          shipments: shipmentsTotal.meta.total,
          routes: routesTotal.meta.total,
          incidentsOpen: incidentsBoard.total_open,
          qualityThreshold: qualityThreshold.threshold,
        },
        shipmentsByStatus: {
          created: shipmentsCreated.meta.total,
          outForDelivery: shipmentsOut.meta.total,
          delivered: shipmentsDelivered.meta.total,
          incident: shipmentsIncident.meta.total,
        },
        routesByStatus: {
          planned: routesPlanned.meta.total,
          inProgress: routesInProgress.meta.total,
          completed: routesCompleted.meta.total,
        },
        quality: {
          routeAvg: averageScore(routeQuality),
          driverAvg: averageScore(driverQuality),
          belowThresholdRoutes: underThresholdRoutes.meta.count ?? underThresholdRoutes.data.length,
        },
        upcomingRoutes: upcomingRoutes.data,
        recentShipments: recentShipments.data,
        recentIncidents: recentIncidents.data,
      });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const qualityBadge = useMemo(() => scoreVariant(data.quality.routeAvg, data.totals.qualityThreshold), [data.quality.routeAvg, data.totals.qualityThreshold]);

  return (
    <section className="page-grid">
      <header>
        <h1 className="page-title">Everything at a glance</h1>
        <p className="page-subtitle">Visión operativa unificada de envíos, rutas, incidencias y calidad.</p>
      </header>

      <div className="page-grid four">
        <Card>
          <CardHeader>
            <CardDescription>Envios totales</CardDescription>
            <CardTitle>{data.totals.shipments}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="helper">Created: {data.shipmentsByStatus.created}</div>
            <div className="helper">Out for delivery: {data.shipmentsByStatus.outForDelivery}</div>
            <div className="helper">Delivered: {data.shipmentsByStatus.delivered}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Rutas activas</CardDescription>
            <CardTitle>{data.totals.routes}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="helper">Planned: {data.routesByStatus.planned}</div>
            <div className="helper">In progress: {data.routesByStatus.inProgress}</div>
            <div className="helper">Completed: {data.routesByStatus.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Incidencias abiertas</CardDescription>
            <CardTitle>{data.totals.incidentsOpen}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="helper">Prioriza SLA y bloqueos de reparto.</div>
            <Link className="helper" to="/incidents">Ir a incidencias</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>KPI calidad rutas</CardDescription>
            <CardTitle>{data.quality.routeAvg.toFixed(2)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={qualityBadge}>
              Umbral {data.totals.qualityThreshold.toFixed(2)}%
            </Badge>
            <div className="helper">Bajo umbral: {data.quality.belowThresholdRoutes}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>Acceso directo a los flujos críticos del día.</CardDescription>
        </CardHeader>
        <CardContent className="inline-actions">
          <Link to="/shipments" className="btn btn-outline">Gestionar envíos</Link>
          <Link to="/routes" className="btn btn-outline">Planificar rutas</Link>
          <Link to="/incidents" className="btn btn-outline">Resolver incidencias</Link>
          <Link to="/quality" className="btn btn-outline">Analizar calidad</Link>
          <Button type="button" onClick={load} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar ahora'}</Button>
        </CardContent>
      </Card>

      {error && <p className="helper error">{error}</p>}

      <div className="page-grid two">
        <Card>
          <CardHeader>
            <CardTitle>Próximas rutas</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Paradas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcomingRoutes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>Sin rutas disponibles</TableCell>
                    </TableRow>
                  )}
                  {data.upcomingRoutes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Link to={`/routes/${item.id}`}>{item.code}</Link></TableCell>
                      <TableCell>{item.route_date}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{item.stops_count ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incidencias recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>SLA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentIncidents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>Sin incidencias abiertas</TableCell>
                    </TableRow>
                  )}
                  {data.recentIncidents.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.incidentable_type}</TableCell>
                      <TableCell>
                        <Badge variant={item.category === 'failed' ? 'destructive' : item.category === 'absent' ? 'warning' : 'secondary'}>
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.sla_status ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Envíos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Externa</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Servicio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentShipments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>Sin envíos</TableCell>
                  </TableRow>
                )}
                {data.recentShipments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><Link to={`/shipments/${item.id}`}>{item.reference}</Link></TableCell>
                    <TableCell>{item.external_reference ?? '-'}</TableCell>
                    <TableCell>{item.consignee_name ?? '-'}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{item.service_type ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}
