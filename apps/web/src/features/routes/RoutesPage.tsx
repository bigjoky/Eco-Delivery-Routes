import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DriverSummary, HubSummary, PaginationMeta, RouteSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function routeStatusHelp(status: string): string {
  const help: Record<string, string> = {
    planned: 'Planificada, pendiente de inicio.',
    in_progress: 'En curso, en reparto.',
    completed: 'Finalizada y cerrada.',
    cancelled: 'Cancelada por operativa.',
  };
  return help[status] ?? status;
}

export function RoutesPage() {
  const [items, setItems] = useState<RouteSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const routesFilterStorageKey = 'eco_delivery_routes_routes_filters';
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedFromParams = useRef(false);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [createHubId, setCreateHubId] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createRouteDate, setCreateRouteDate] = useState('');
  const [createSubcontractorId, setCreateSubcontractorId] = useState('');
  const [subcontractorFilter, setSubcontractorFilter] = useState('');
  const [createDriverId, setCreateDriverId] = useState('');
  const [createVehicleId, setCreateVehicleId] = useState('');
  const [createError, setCreateError] = useState('');
  const [createPreviewConflicts, setCreatePreviewConflicts] = useState<string[]>([]);
  const [createPreviewWarnings, setCreatePreviewWarnings] = useState<string[]>([]);
  const [createRecommendedSubcontractorId, setCreateRecommendedSubcontractorId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const routeSummary = useMemo(() => {
    const counts = items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: meta.total,
      planned: counts.planned ?? 0,
      inProgress: counts.in_progress ?? 0,
      completed: counts.completed ?? 0,
      cancelled: counts.cancelled ?? 0,
      pageCount: items.length,
    };
  }, [items, meta.total]);

  const reload = (page: number) =>
    apiClient
      .getRoutes({
        page,
        perPage: meta.per_page,
        status: status || undefined,
        hubId: hubFilter || undefined,
        subcontractorId: subcontractorFilter || undefined,
        q: query || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sort: 'route_date',
        dir: 'desc',
      })
      .then((result) => {
        setItems(result.data);
        setMeta(result.meta);
      });

  useEffect(() => {
    if (!initializedFromParams.current) return;
    reload(1);
  }, [status, hubFilter, subcontractorFilter, query, dateFrom, dateTo]);

  useEffect(() => {
    if (initializedFromParams.current) return;
    const statusParam = searchParams.get('status') ?? '';
    const hubParam = searchParams.get('hub_id') ?? '';
    const qParam = searchParams.get('q') ?? '';
    const dateFromParam = searchParams.get('date_from') ?? '';
    const dateToParam = searchParams.get('date_to') ?? '';
    const pageParam = Number(searchParams.get('page') ?? '1');

    if (statusParam) setStatus(statusParam);
    if (hubParam) setHubFilter(hubParam);
    const subcontractorParam = searchParams.get('subcontractor_id') ?? '';
    if (subcontractorParam) setSubcontractorFilter(subcontractorParam);
    if (qParam) setQuery(qParam);
    if (dateFromParam) setDateFrom(dateFromParam);
    if (dateToParam) setDateTo(dateToParam);

    initializedFromParams.current = true;
    const initialPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    reload(initialPage);
  }, [searchParams]);

  useEffect(() => {
    if (!initializedFromParams.current) return;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (hubFilter) params.set('hub_id', hubFilter);
    if (query) params.set('q', query);
    if (subcontractorFilter) params.set('subcontractor_id', subcontractorFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    params.set('page', String(meta.page));
    setSearchParams(params, { replace: true });
  }, [status, hubFilter, subcontractorFilter, query, dateFrom, dateTo, meta.page, setSearchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(routesFilterStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<{
        status: string;
        hubFilter: string;
        subcontractorFilter: string;
        query: string;
        dateFrom: string;
        dateTo: string;
      }>;
      if (parsed.status && !status) setStatus(parsed.status);
      if (parsed.hubFilter && !hubFilter) setHubFilter(parsed.hubFilter);
      if (parsed.subcontractorFilter && !subcontractorFilter) setSubcontractorFilter(parsed.subcontractorFilter);
      if (parsed.query && !query) setQuery(parsed.query);
      if (parsed.dateFrom && !dateFrom) setDateFrom(parsed.dateFrom);
      if (parsed.dateTo && !dateTo) setDateTo(parsed.dateTo);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      status,
      hubFilter,
      subcontractorFilter,
      query,
      dateFrom,
      dateTo,
    };
    window.localStorage.setItem(routesFilterStorageKey, JSON.stringify(payload));
  }, [status, hubFilter, subcontractorFilter, query, dateFrom, dateTo]);

  useEffect(() => {
    apiClient.getHubs({ onlyActive: true }).then((rows) => {
      setHubs(rows);
      if (!createHubId && rows.length > 0) setCreateHubId(rows[0].id);
    }).catch(() => setHubs([]));
    apiClient.getSubcontractors({ limit: 100 }).then(setSubcontractors).catch(() => setSubcontractors([]));
    apiClient.getDrivers({ status: 'active', limit: 100 }).then(setDrivers).catch(() => setDrivers([]));
    apiClient.getVehicles({ status: 'active', limit: 100 }).then(setVehicles).catch(() => setVehicles([]));
    setCreateRouteDate(new Date().toISOString().slice(0, 10));
  }, []);

  const filteredDrivers = createSubcontractorId
    ? drivers.filter((item) => !item.subcontractor_id || item.subcontractor_id === createSubcontractorId)
    : drivers;

  const filteredVehicles = createSubcontractorId
    ? vehicles.filter((item) => !item.subcontractor_id || item.subcontractor_id === createSubcontractorId)
    : vehicles;

  const createRoute = async () => {
    const nextErrors: string[] = [];
    if (!createHubId) nextErrors.push('Hub obligatorio.');
    if (!createCode) nextErrors.push('Codigo obligatorio.');
    if (!createRouteDate) nextErrors.push('Fecha obligatoria.');
    const selectedDriver = createDriverId ? drivers.find((item) => item.id === createDriverId) : null;
    const selectedVehicle = createVehicleId ? vehicles.find((item) => item.id === createVehicleId) : null;
    if (createSubcontractorId && selectedDriver?.subcontractor_id && selectedDriver.subcontractor_id !== createSubcontractorId) {
      nextErrors.push('El conductor seleccionado no pertenece a la subcontrata elegida.');
    }
    if (createSubcontractorId && selectedVehicle?.subcontractor_id && selectedVehicle.subcontractor_id !== createSubcontractorId) {
      nextErrors.push('El vehiculo seleccionado no pertenece a la subcontrata elegida.');
    }
    if (selectedDriver && selectedVehicle?.assigned_driver_id && selectedVehicle.assigned_driver_id !== selectedDriver.id) {
      nextErrors.push('El vehiculo esta asignado a otro conductor.');
    }
    if (nextErrors.length > 0) {
      setCreateError(nextErrors.join(' '));
      return;
    }
    if (createDriverId || createVehicleId || createSubcontractorId) {
      const preview = await apiClient.previewRouteAssignment({
        subcontractor_id: createSubcontractorId || null,
        driver_id: createDriverId || null,
        vehicle_id: createVehicleId || null,
        route_date: createRouteDate || null,
      });
      setCreatePreviewConflicts(preview.conflicts.map((item) => item.message));
      setCreatePreviewWarnings((preview.warnings ?? []).map((item) => item.message));
      setCreateRecommendedSubcontractorId(preview.recommended_subcontractor_id ?? null);
      if (!preview.valid) {
        setCreateError('Corrige las inconsistencias de asignacion antes de crear la ruta.');
        return;
      }
    }

    setCreating(true);
    setCreateError('');
    try {
      await apiClient.createRoute({
        hub_id: createHubId,
        code: createCode,
        route_date: createRouteDate,
        subcontractor_id: createSubcontractorId || null,
        driver_id: createDriverId || null,
        vehicle_id: createVehicleId || null,
      });
      setCreateCode('');
      setCreateSubcontractorId('');
      setCreateDriverId('');
      setCreateVehicleId('');
      await reload(1);
    } catch (exception) {
      setCreateError(exception instanceof Error ? exception.message : 'No se pudo crear la ruta');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!createDriverId && !createVehicleId && !createSubcontractorId) {
      setCreatePreviewConflicts([]);
      setCreatePreviewWarnings([]);
      setCreateRecommendedSubcontractorId(null);
      return;
    }
    apiClient.previewRouteAssignment({
      subcontractor_id: createSubcontractorId || null,
      driver_id: createDriverId || null,
      vehicle_id: createVehicleId || null,
      route_date: createRouteDate || null,
    })
      .then((preview) => {
        setCreatePreviewConflicts(preview.conflicts.map((item) => item.message));
        setCreatePreviewWarnings((preview.warnings ?? []).map((item) => item.message));
        setCreateRecommendedSubcontractorId(preview.recommended_subcontractor_id ?? null);
      })
      .catch(() => {
        setCreatePreviewConflicts([]);
        setCreatePreviewWarnings([]);
        setCreateRecommendedSubcontractorId(null);
      });
  }, [createSubcontractorId, createDriverId, createVehicleId, createRouteDate]);

  const setQuickRange = (range: 'today' | 'tomorrow' | 'next7' | 'clear') => {
    if (range === 'clear') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const today = new Date();
    const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
    if (range === 'today') {
      const day = toIsoDate(today);
      setDateFrom(day);
      setDateTo(day);
      return;
    }
    if (range === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const day = toIsoDate(tomorrow);
      setDateFrom(day);
      setDateTo(day);
      return;
    }
    const start = toIsoDate(today);
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    setDateFrom(start);
    setDateTo(toIsoDate(end));
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Crear Ruta</CardTitle>
          <div className="page-subtitle">Planifica hubs, fechas y asignaciones en un solo paso.</div>
        </CardHeader>
        <CardContent>
          <div className="form-row">
            <div>
              <label htmlFor="create-route-hub">Hub</label>
              <select id="create-route-hub" value={createHubId} onChange={(event) => setCreateHubId(event.target.value)}>
                <option value="">Selecciona hub</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="create-route-code">Codigo</label>
              <input
                id="create-route-code"
                value={createCode}
                onChange={(event) => setCreateCode(event.target.value)}
                placeholder="R-AGP-20260305-01"
              />
            </div>
            <div>
              <label htmlFor="create-route-date">Fecha</label>
              <input
                id="create-route-date"
                type="date"
                value={createRouteDate}
                onChange={(event) => setCreateRouteDate(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="create-route-subcontractor">Subcontrata</label>
              <select
                id="create-route-subcontractor"
                value={createSubcontractorId}
                onChange={(event) => setCreateSubcontractorId(event.target.value)}
              >
                <option value="">Sin asignar</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="create-route-driver">Conductor</label>
              <select id="create-route-driver" value={createDriverId} onChange={(event) => setCreateDriverId(event.target.value)}>
                <option value="">Sin asignar</option>
                {filteredDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.code} - {driver.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="create-route-vehicle">Vehiculo</label>
              <select id="create-route-vehicle" value={createVehicleId} onChange={(event) => setCreateVehicleId(event.target.value)}>
                <option value="">Sin asignar</option>
                {filteredVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.code} {vehicle.plate_number ? `(${vehicle.plate_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="inline-actions">
            <Button type="button" onClick={createRoute} disabled={creating}>
              {creating ? 'Creando...' : 'Crear ruta'}
            </Button>
          </div>
          {createPreviewConflicts.length > 0 ? (
            <div className="helper error">{createPreviewConflicts.join(' ')}</div>
          ) : null}
          {createPreviewWarnings.length > 0 ? (
            <div className="helper">{createPreviewWarnings.join(' ')}</div>
          ) : null}
          {createRecommendedSubcontractorId && !createSubcontractorId ? (
            <div className="helper">Sugerencia: seleccionar subcontrata vinculada automaticamente ({createRecommendedSubcontractorId}).</div>
          ) : null}
          {createError ? <div className="helper">{createError}</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Rutas</CardTitle>
          <div className="page-subtitle">Listado operativo con filtros por estado, hub y fechas.</div>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Total</div>
              <div className="kpi-value">{routeSummary.total}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">En página</div>
              <div className="kpi-value">{routeSummary.pageCount}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Planned</div>
              <div className="kpi-value">{routeSummary.planned}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">En ruta</div>
              <div className="kpi-value">{routeSummary.inProgress}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Completadas</div>
              <div className="kpi-value">{routeSummary.completed}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Canceladas</div>
              <div className="kpi-value">{routeSummary.cancelled}</div>
            </div>
          </div>
          <div className="form-row">
            <div>
              <label htmlFor="route-query">Buscar</label>
              <input
                id="route-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Codigo ruta o referencia"
              />
            </div>
            <div>
              <label htmlFor="route-hub">Hub</label>
              <select id="route-hub" value={hubFilter} onChange={(event) => setHubFilter(event.target.value)}>
                <option value="">Todos</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="route-subcontractor">Subcontrata</label>
              <select
                id="route-subcontractor"
                value={subcontractorFilter}
                onChange={(event) => setSubcontractorFilter(event.target.value)}
              >
                <option value="">Todas</option>
                {subcontractors.map((item) => (
                  <option key={item.id} value={item.id}>{item.legal_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="route-status">Estado</label>
              <select
                id="route-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="planned">planned</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="route-date-from">Desde</label>
              <input
                id="route-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="route-date-to">Hasta</label>
              <input
                id="route-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          </div>
          <div className="inline-actions">
            <span className="helper">Estados rapidos</span>
            <Button type="button" variant={status === '' ? 'secondary' : 'outline'} onClick={() => setStatus('')}>Todos</Button>
            <Button type="button" variant={status === 'planned' ? 'secondary' : 'outline'} onClick={() => setStatus('planned')}>Planned</Button>
            <Button type="button" variant={status === 'in_progress' ? 'secondary' : 'outline'} onClick={() => setStatus('in_progress')}>En ruta</Button>
            <Button type="button" variant={status === 'completed' ? 'secondary' : 'outline'} onClick={() => setStatus('completed')}>Completada</Button>
            <Button type="button" variant={status === 'cancelled' ? 'secondary' : 'outline'} onClick={() => setStatus('cancelled')}>Cancelada</Button>
            <Button type="button" variant="outline" onClick={() => setQuickRange('today')}>Hoy</Button>
            <Button type="button" variant="outline" onClick={() => setQuickRange('tomorrow')}>Manana</Button>
            <Button type="button" variant="outline" onClick={() => setQuickRange('next7')}>Prox 7 dias</Button>
            <Button type="button" variant="outline" onClick={() => setQuickRange('clear')}>Limpiar</Button>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Vehiculo</TableHead>
                  <TableHead>Paradas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to={`/routes/${item.id}`}>{item.code}</Link>
                    </TableCell>
                    <TableCell>{item.route_date}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" title={routeStatusHelp(item.status)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.driver_code ?? '-'}</TableCell>
                    <TableCell>{item.vehicle_code ?? '-'}</TableCell>
                    <TableCell>{item.stops_count ?? 0}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>Sin rutas para los filtros seleccionados.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => reload(Math.max(1, meta.page - 1))} disabled={meta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {meta.page} / {Math.max(1, meta.last_page || 1)}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => reload(meta.page + 1)}
              disabled={meta.page >= meta.last_page}
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
