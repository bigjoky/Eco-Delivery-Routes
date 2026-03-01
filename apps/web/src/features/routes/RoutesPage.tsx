import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DriverSummary, HubSummary, PaginationMeta, RouteSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

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
  const [creating, setCreating] = useState(false);

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
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <label htmlFor="create-route-hub">Hub</label>
            <select id="create-route-hub" value={createHubId} onChange={(event) => setCreateHubId(event.target.value)}>
              <option value="">Selecciona hub</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
              ))}
            </select>
            <label htmlFor="create-route-code">Codigo</label>
            <input
              id="create-route-code"
              value={createCode}
              onChange={(event) => setCreateCode(event.target.value)}
              placeholder="R-AGP-20260305-01"
            />
            <label htmlFor="create-route-date">Fecha</label>
            <input
              id="create-route-date"
              type="date"
              value={createRouteDate}
              onChange={(event) => setCreateRouteDate(event.target.value)}
            />
          </div>
          <div className="inline-actions">
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
            <label htmlFor="create-route-driver">Conductor</label>
            <select id="create-route-driver" value={createDriverId} onChange={(event) => setCreateDriverId(event.target.value)}>
              <option value="">Sin asignar</option>
              {filteredDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.code} - {driver.name}</option>
              ))}
            </select>
            <label htmlFor="create-route-vehicle">Vehiculo</label>
            <select id="create-route-vehicle" value={createVehicleId} onChange={(event) => setCreateVehicleId(event.target.value)}>
              <option value="">Sin asignar</option>
              {filteredVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.code} {vehicle.plate_number ? `(${vehicle.plate_number})` : ''}
                </option>
              ))}
            </select>
            <Button type="button" onClick={createRoute} disabled={creating}>
              {creating ? 'Creando...' : 'Crear ruta'}
            </Button>
          </div>
          {createError ? <div className="helper">{createError}</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Rutas</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                    <TableCell>{item.driver_code ?? '-'}</TableCell>
                    <TableCell>{item.vehicle_code ?? '-'}</TableCell>
                    <TableCell>{item.stops_count ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <label htmlFor="route-query">Buscar</label>
            <input
              id="route-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Codigo ruta"
            />
            <div className="inline-actions">
              <span className="helper">Estados rapidos</span>
              <Button type="button" variant={status === '' ? 'secondary' : 'outline'} onClick={() => setStatus('')}>Todos</Button>
              <Button type="button" variant={status === 'planned' ? 'secondary' : 'outline'} onClick={() => setStatus('planned')}>Planned</Button>
              <Button type="button" variant={status === 'in_progress' ? 'secondary' : 'outline'} onClick={() => setStatus('in_progress')}>En ruta</Button>
              <Button type="button" variant={status === 'completed' ? 'secondary' : 'outline'} onClick={() => setStatus('completed')}>Completada</Button>
              <Button type="button" variant={status === 'cancelled' ? 'secondary' : 'outline'} onClick={() => setStatus('cancelled')}>Cancelada</Button>
            </div>
            <label htmlFor="route-hub">Hub</label>
            <select id="route-hub" value={hubFilter} onChange={(event) => setHubFilter(event.target.value)}>
              <option value="">Todos</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
              ))}
            </select>
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
          <div className="inline-actions">
            <label htmlFor="route-date-from">Desde</label>
            <input
              id="route-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <label htmlFor="route-date-to">Hasta</label>
            <input
              id="route-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            <div className="inline-actions">
              <span className="helper">Rangos rapidos</span>
              <Button type="button" variant="outline" onClick={() => setQuickRange('today')}>Hoy</Button>
              <Button type="button" variant="outline" onClick={() => setQuickRange('tomorrow')}>Manana</Button>
              <Button type="button" variant="outline" onClick={() => setQuickRange('next7')}>Prox 7 dias</Button>
              <Button type="button" variant="outline" onClick={() => setQuickRange('clear')}>Limpiar</Button>
            </div>
          </div>
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
