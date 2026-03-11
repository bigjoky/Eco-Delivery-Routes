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
  const [estimatedShipmentsCount, setEstimatedShipmentsCount] = useState('0');
  const [estimatedAvgWeightKg, setEstimatedAvgWeightKg] = useState('0');
  const [publishPolicyLoading, setPublishPolicyLoading] = useState(false);
  const [publishPolicySaving, setPublishPolicySaving] = useState(false);
  const [publishPolicyError, setPublishPolicyError] = useState('');
  const [publishPolicyEnforce, setPublishPolicyEnforce] = useState(true);
  const [publishPolicyCriticalCodes, setPublishPolicyCriticalCodes] = useState<string[]>(['LOW_DRIVER_QUALITY', 'LOW_SUBCONTRACTOR_QUALITY']);
  const [publishPolicyBypassRoles, setPublishPolicyBypassRoles] = useState('super_admin');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [bulkSubcontractorId, setBulkSubcontractorId] = useState('');
  const [bulkDriverId, setBulkDriverId] = useState('');
  const [bulkVehicleId, setBulkVehicleId] = useState('');
  const [bulkSetUnassigned, setBulkSetUnassigned] = useState(false);
  const [bulkPreviewWarnings, setBulkPreviewWarnings] = useState<string[]>([]);
  const [bulkPreviewConflicts, setBulkPreviewConflicts] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<'' | 'planned' | 'in_progress' | 'completed'>('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkError, setBulkError] = useState('');

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

  const activeFiltersCount = useMemo(() => {
    return [query, hubFilter, subcontractorFilter, status, dateFrom, dateTo].filter((value) => value !== '').length;
  }, [query, hubFilter, subcontractorFilter, status, dateFrom, dateTo]);

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
    apiClient.getHubs({ onlyActive: false }).then((rows) => {
      setHubs(rows);
      if (!createHubId && rows.length > 0) setCreateHubId(rows[0].id);
    }).catch(() => setHubs([]));
    apiClient.getSubcontractors({ limit: 100 }).then(setSubcontractors).catch(() => setSubcontractors([]));
    apiClient.getDrivers({ status: 'active', limit: 100 }).then(setDrivers).catch(() => setDrivers([]));
    apiClient.getVehicles({ status: 'active', limit: 100 }).then(setVehicles).catch(() => setVehicles([]));
    setCreateRouteDate(new Date().toISOString().slice(0, 10));
    setPublishPolicyLoading(true);
    apiClient.getRouteAssignmentPublishPolicy()
      .then((policy) => {
        setPublishPolicyEnforce(policy.enforce_on_publish);
        setPublishPolicyCriticalCodes(policy.critical_warning_codes);
        setPublishPolicyBypassRoles(policy.bypass_role_codes.join(','));
      })
      .catch((exception) => {
        setPublishPolicyError(exception instanceof Error ? exception.message : 'No se pudo cargar la policy de publicación');
      })
      .finally(() => setPublishPolicyLoading(false));
  }, []);

  useEffect(() => {
    setSelectedRouteIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const filteredDrivers = createSubcontractorId
    ? drivers.filter((item) => !item.subcontractor_id || item.subcontractor_id === createSubcontractorId)
    : drivers;

  const filteredVehicles = createSubcontractorId
    ? vehicles.filter((item) => !item.subcontractor_id || item.subcontractor_id === createSubcontractorId)
    : vehicles;
  const bulkDrivers = bulkSubcontractorId
    ? drivers.filter((item) => !item.subcontractor_id || item.subcontractor_id === bulkSubcontractorId)
    : drivers;
  const bulkVehicles = bulkSubcontractorId
    ? vehicles.filter((item) => !item.subcontractor_id || item.subcontractor_id === bulkSubcontractorId)
    : vehicles;
  const selectedCreateVehicle = createVehicleId ? vehicles.find((item) => item.id === createVehicleId) : null;
  const estimatedLoadKg = Math.max(0, Number(estimatedShipmentsCount) || 0) * Math.max(0, Number(estimatedAvgWeightKg) || 0);
  const loadCapacityDeltaKg = (selectedCreateVehicle?.capacity_kg ?? 0) - estimatedLoadKg;
  const loadUtilization = selectedCreateVehicle && (selectedCreateVehicle.capacity_kg ?? 0) > 0
    ? (estimatedLoadKg / (selectedCreateVehicle.capacity_kg ?? 1)) * 100
    : null;

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

  const toggleCriticalCode = (code: string) => {
    setPublishPolicyCriticalCodes((current) => (
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    ));
  };

  const savePublishPolicy = async () => {
    setPublishPolicySaving(true);
    setPublishPolicyError('');
    try {
      const bypassRoles = publishPolicyBypassRoles
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== '');
      const saved = await apiClient.updateRouteAssignmentPublishPolicy({
        enforce_on_publish: publishPolicyEnforce,
        critical_warning_codes: publishPolicyCriticalCodes,
        bypass_role_codes: bypassRoles.length > 0 ? bypassRoles : ['super_admin'],
      });
      setPublishPolicyEnforce(saved.enforce_on_publish);
      setPublishPolicyCriticalCodes(saved.critical_warning_codes);
      setPublishPolicyBypassRoles(saved.bypass_role_codes.join(','));
    } catch (exception) {
      setPublishPolicyError(exception instanceof Error ? exception.message : 'No se pudo guardar la policy de publicación');
    } finally {
      setPublishPolicySaving(false);
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

  const clearFilters = () => {
    setStatus('');
    setQuery('');
    setHubFilter('');
    setSubcontractorFilter('');
    setDateFrom('');
    setDateTo('');
    setMeta((current) => ({ ...current, page: 1 }));
  };

  const toggleRouteSelection = (routeId: string) => {
    setSelectedRouteIds((current) => (
      current.includes(routeId)
        ? current.filter((id) => id !== routeId)
        : [...current, routeId]
    ));
  };

  const toggleSelectCurrentPage = () => {
    const pageIds = items.map((item) => item.id);
    setSelectedRouteIds((current) => {
      const allSelected = pageIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !pageIds.includes(id));
      return Array.from(new Set([...current, ...pageIds]));
    });
  };

  const previewBulkAssignment = async () => {
    setBulkError('');
    setBulkMessage('');
    if (selectedRouteIds.length === 0) {
      setBulkError('Selecciona al menos una ruta.');
      return;
    }
    if (!bulkSetUnassigned && !bulkSubcontractorId && !bulkDriverId && !bulkVehicleId) {
      setBulkError('Define una asignación o marca "dejar sin asignar".');
      return;
    }
    try {
      const preview = await apiClient.previewRouteAssignment({
        subcontractor_id: bulkSetUnassigned ? null : (bulkSubcontractorId || null),
        driver_id: bulkSetUnassigned ? null : (bulkDriverId || null),
        vehicle_id: bulkSetUnassigned ? null : (bulkVehicleId || null),
      });
      setBulkPreviewConflicts(preview.conflicts.map((item) => item.message));
      setBulkPreviewWarnings((preview.warnings ?? []).map((item) => item.message));
      if (!preview.valid) {
        setBulkError('La combinación seleccionada tiene conflictos de asignación.');
        return;
      }
      setBulkMessage(`Preview OK para ${selectedRouteIds.length} ruta(s).`);
    } catch (exception) {
      setBulkError(exception instanceof Error ? exception.message : 'No se pudo previsualizar la asignación masiva');
    }
  };

  const applyBulkAssignment = async () => {
    setBulkError('');
    setBulkMessage('');
    if (selectedRouteIds.length === 0) {
      setBulkError('Selecciona al menos una ruta.');
      return;
    }
    if (!bulkSetUnassigned && !bulkSubcontractorId && !bulkDriverId && !bulkVehicleId) {
      setBulkError('Define una asignación o marca "dejar sin asignar".');
      return;
    }
    try {
      setBulkUpdating(true);
      const payload = bulkSetUnassigned
        ? { subcontractor_id: null, driver_id: null, vehicle_id: null }
        : {
          subcontractor_id: bulkSubcontractorId || null,
          driver_id: bulkDriverId || null,
          vehicle_id: bulkVehicleId || null,
        };

      for (const routeId of selectedRouteIds) {
        await apiClient.updateRoute(routeId, payload);
      }

      setBulkMessage(`Asignación masiva aplicada sobre ${selectedRouteIds.length} ruta(s).`);
      setSelectedRouteIds([]);
      await reload(meta.page);
    } catch (exception) {
      setBulkError(exception instanceof Error ? exception.message : 'No se pudo aplicar la asignación masiva');
    } finally {
      setBulkUpdating(false);
    }
  };

  const applyBulkStatus = async () => {
    setBulkError('');
    setBulkMessage('');
    if (!bulkStatus) {
      setBulkError('Selecciona un estado masivo para rutas.');
      return;
    }
    if (selectedRouteIds.length === 0) {
      setBulkError('Selecciona al menos una ruta.');
      return;
    }
    let updatedCount = 0;
    try {
      setBulkUpdating(true);
      for (const routeId of selectedRouteIds) {
        try {
          await apiClient.updateRoute(routeId, { status: bulkStatus });
          updatedCount += 1;
        } catch {
          // Continue best-effort in batch mode
        }
      }
      if (updatedCount === 0) {
        setBulkError('No se pudo actualizar estado en rutas seleccionadas.');
      } else {
        setBulkMessage(`Estado "${bulkStatus}" aplicado en ${updatedCount}/${selectedRouteIds.length} ruta(s).`);
      }
      await reload(meta.page);
    } catch (exception) {
      setBulkError(exception instanceof Error ? exception.message : 'No se pudo aplicar estado masivo');
    } finally {
      setBulkUpdating(false);
    }
  };

  const applyAssignmentPreset = (preset: 'clear' | 'smart_scope' | 'driver_only' | 'vehicle_only') => {
    if (preset === 'clear') {
      setBulkSetUnassigned(false);
      setBulkSubcontractorId('');
      setBulkDriverId('');
      setBulkVehicleId('');
      setBulkPreviewWarnings([]);
      setBulkPreviewConflicts([]);
      setBulkMessage('');
      setBulkError('');
      return;
    }
    if (preset === 'smart_scope') {
      if (bulkDriverId) {
        const driver = drivers.find((item) => item.id === bulkDriverId);
        if (driver?.subcontractor_id) setBulkSubcontractorId(driver.subcontractor_id);
      }
      if (bulkVehicleId) {
        const vehicle = vehicles.find((item) => item.id === bulkVehicleId);
        if (vehicle?.subcontractor_id) setBulkSubcontractorId(vehicle.subcontractor_id);
      }
      setBulkSetUnassigned(false);
      return;
    }
    if (preset === 'driver_only') {
      setBulkVehicleId('');
      setBulkSetUnassigned(false);
      return;
    }
    if (preset === 'vehicle_only') {
      setBulkDriverId('');
      setBulkSetUnassigned(false);
    }
  };

  const applyStatusPreset = (preset: 'planned' | 'in_progress' | 'completed' | 'clear') => {
    if (preset === 'clear') {
      setBulkStatus('');
      return;
    }
    setBulkStatus(preset);
  };

  const quickUpdateRouteStatus = async (routeId: string, nextStatus: 'planned' | 'in_progress' | 'completed') => {
    setBulkError('');
    setBulkMessage('');
    try {
      await apiClient.updateRoute(routeId, { status: nextStatus });
      setBulkMessage(`Ruta actualizada a ${nextStatus}.`);
      await reload(meta.page);
    } catch (exception) {
      setBulkError(exception instanceof Error ? exception.message : 'No se pudo actualizar la ruta');
    }
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
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Simulador carga: envíos estimados</div>
              <input
                type="number"
                min={0}
                value={estimatedShipmentsCount}
                onChange={(event) => setEstimatedShipmentsCount(event.target.value)}
              />
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Peso medio por envío (kg)</div>
              <input
                type="number"
                min={0}
                step="0.1"
                value={estimatedAvgWeightKg}
                onChange={(event) => setEstimatedAvgWeightKg(event.target.value)}
              />
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Carga total estimada (kg)</div>
              <div className="kpi-value">{estimatedLoadKg.toFixed(1)}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Delta vs capacidad vehículo</div>
              <div className="kpi-value">{selectedCreateVehicle ? loadCapacityDeltaKg.toFixed(1) : '-'}</div>
              <div className="helper">
                {selectedCreateVehicle
                  ? `Capacidad: ${selectedCreateVehicle.capacity_kg ?? 0} kg`
                  : 'Selecciona vehículo'}
              </div>
              {loadUtilization !== null ? (
                <Badge variant={loadUtilization > 100 ? 'destructive' : loadUtilization > 90 ? 'warning' : 'success'}>
                  Uso estimado {loadUtilization.toFixed(1)}%
                </Badge>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Policy Publicación de Ruta</CardTitle>
          <div className="page-subtitle">Bloquea paso a in_progress cuando existan warnings críticos.</div>
        </CardHeader>
        <CardContent>
          {publishPolicyLoading ? <div className="helper">Cargando policy...</div> : null}
          {publishPolicyError ? <div className="helper error">{publishPolicyError}</div> : null}
          <div className="inline-actions">
            <label htmlFor="publish-policy-enforce">Enforce on publish</label>
            <input
              id="publish-policy-enforce"
              type="checkbox"
              checked={publishPolicyEnforce}
              onChange={(event) => setPublishPolicyEnforce(event.target.checked)}
            />
            <label htmlFor="publish-policy-bypass">Roles bypass (csv)</label>
            <input
              id="publish-policy-bypass"
              value={publishPolicyBypassRoles}
              onChange={(event) => setPublishPolicyBypassRoles(event.target.value)}
              placeholder="super_admin,operations_manager"
            />
            <Button type="button" onClick={savePublishPolicy} disabled={publishPolicySaving}>
              {publishPolicySaving ? 'Guardando...' : 'Guardar policy'}
            </Button>
          </div>
          <div className="inline-actions">
            <label>
              <input
                type="checkbox"
                checked={publishPolicyCriticalCodes.includes('LOW_DRIVER_QUALITY')}
                onChange={() => toggleCriticalCode('LOW_DRIVER_QUALITY')}
              />
              LOW_DRIVER_QUALITY
            </label>
            <label>
              <input
                type="checkbox"
                checked={publishPolicyCriticalCodes.includes('LOW_SUBCONTRACTOR_QUALITY')}
                onChange={() => toggleCriticalCode('LOW_SUBCONTRACTOR_QUALITY')}
              />
              LOW_SUBCONTRACTOR_QUALITY
            </label>
            <label>
              <input
                type="checkbox"
                checked={publishPolicyCriticalCodes.includes('MISSING_VEHICLE_CAPACITY')}
                onChange={() => toggleCriticalCode('MISSING_VEHICLE_CAPACITY')}
              />
              MISSING_VEHICLE_CAPACITY
            </label>
          </div>
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
          <div className="inline-actions ops-toolbar">
            <Button type="button" variant={showFilters ? 'secondary' : 'outline'} onClick={() => setShowFilters((value) => !value)}>
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </Button>
            <span className="helper">Filtros activos: {activeFiltersCount}</span>
            {activeFiltersCount > 0 ? (
              <Button type="button" variant="outline" onClick={clearFilters}>Limpiar todo</Button>
            ) : null}
          </div>
          <div className="filters-panel">
            <div className="inline-actions ops-toolbar">
              <span className="helper">Reasignación masiva</span>
              <span className="helper">{selectedRouteIds.length} seleccionada(s)</span>
            </div>
            <div className="form-row">
              <div>
                <label htmlFor="routes-bulk-subcontractor">Subcontrata</label>
                <select
                  id="routes-bulk-subcontractor"
                  value={bulkSubcontractorId}
                  onChange={(event) => setBulkSubcontractorId(event.target.value)}
                  disabled={bulkSetUnassigned}
                >
                  <option value="">Sin cambio</option>
                  {subcontractors.map((item) => (
                    <option key={item.id} value={item.id}>{item.legal_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="routes-bulk-driver">Conductor</label>
                <select
                  id="routes-bulk-driver"
                  value={bulkDriverId}
                  onChange={(event) => setBulkDriverId(event.target.value)}
                  disabled={bulkSetUnassigned}
                >
                  <option value="">Sin cambio</option>
                  {bulkDrivers.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="routes-bulk-vehicle">Vehículo</label>
                <select
                  id="routes-bulk-vehicle"
                  value={bulkVehicleId}
                  onChange={(event) => setBulkVehicleId(event.target.value)}
                  disabled={bulkSetUnassigned}
                >
                  <option value="">Sin cambio</option>
                  {bulkVehicles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} {item.plate_number ? `(${item.plate_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="inline-actions ops-toolbar">
              <span className="helper">Presets asignación</span>
              <Button type="button" variant="outline" onClick={() => applyAssignmentPreset('smart_scope')} disabled={bulkUpdating}>
                Alinear subcontrata
              </Button>
              <Button type="button" variant="outline" onClick={() => applyAssignmentPreset('driver_only')} disabled={bulkUpdating}>
                Solo conductor
              </Button>
              <Button type="button" variant="outline" onClick={() => applyAssignmentPreset('vehicle_only')} disabled={bulkUpdating}>
                Solo vehículo
              </Button>
              <Button type="button" variant="outline" onClick={() => applyAssignmentPreset('clear')} disabled={bulkUpdating}>
                Limpiar
              </Button>
            </div>
            <div className="inline-actions ops-toolbar">
              <label htmlFor="routes-bulk-unassigned">Dejar sin asignar</label>
              <input
                id="routes-bulk-unassigned"
                type="checkbox"
                checked={bulkSetUnassigned}
                onChange={(event) => setBulkSetUnassigned(event.target.checked)}
              />
              <Button type="button" variant="outline" onClick={previewBulkAssignment} disabled={bulkUpdating}>
                Previsualizar
              </Button>
              <Button type="button" onClick={applyBulkAssignment} disabled={bulkUpdating}>
                {bulkUpdating ? 'Aplicando...' : 'Aplicar asignación masiva'}
              </Button>
            </div>
            <div className="inline-actions ops-toolbar">
              <label htmlFor="routes-bulk-status">Estado masivo</label>
              <select
                id="routes-bulk-status"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as '' | 'planned' | 'in_progress' | 'completed')}
              >
                <option value="">Sin cambio</option>
                <option value="planned">planned</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
              </select>
              <Button type="button" variant="outline" onClick={() => applyStatusPreset('planned')} disabled={bulkUpdating}>Planned</Button>
              <Button type="button" variant="outline" onClick={() => applyStatusPreset('in_progress')} disabled={bulkUpdating}>En ruta</Button>
              <Button type="button" variant="outline" onClick={() => applyStatusPreset('completed')} disabled={bulkUpdating}>Completa</Button>
              <Button type="button" variant="outline" onClick={() => applyStatusPreset('clear')} disabled={bulkUpdating}>Limpiar</Button>
              <Button type="button" variant="outline" onClick={applyBulkStatus} disabled={bulkUpdating || !bulkStatus}>
                Aplicar estado masivo
              </Button>
            </div>
            {bulkPreviewConflicts.length > 0 ? <div className="helper error">{bulkPreviewConflicts.join(' ')}</div> : null}
            {bulkPreviewWarnings.length > 0 ? <div className="helper">{bulkPreviewWarnings.join(' ')}</div> : null}
            {bulkError ? <div className="helper error">{bulkError}</div> : null}
            {bulkMessage ? <div className="helper">{bulkMessage}</div> : null}
          </div>
          {showFilters ? (
            <div className="filters-panel">
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
              <div className="inline-actions ops-toolbar">
                <span className="helper">Estados rapidos</span>
                <Button type="button" variant={status === '' ? 'secondary' : 'outline'} onClick={() => setStatus('')}>Todos</Button>
                <Button type="button" variant={status === 'planned' ? 'secondary' : 'outline'} onClick={() => setStatus('planned')}>Planned</Button>
                <Button type="button" variant={status === 'in_progress' ? 'secondary' : 'outline'} onClick={() => setStatus('in_progress')}>En ruta</Button>
                <Button type="button" variant={status === 'completed' ? 'secondary' : 'outline'} onClick={() => setStatus('completed')}>Completada</Button>
                <Button type="button" variant={status === 'cancelled' ? 'secondary' : 'outline'} onClick={() => setStatus('cancelled')}>Cancelada</Button>
                <Button type="button" variant="outline" onClick={() => setQuickRange('today')}>Hoy</Button>
                <Button type="button" variant="outline" onClick={() => setQuickRange('tomorrow')}>Manana</Button>
                <Button type="button" variant="outline" onClick={() => setQuickRange('next7')}>Prox 7 dias</Button>
                <Button type="button" variant="outline" onClick={() => setQuickRange('clear')}>Limpiar fechas</Button>
              </div>
            </div>
          ) : null}
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((item) => selectedRouteIds.includes(item.id))}
                      onChange={toggleSelectCurrentPage}
                    />
                  </TableHead>
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
                      <input
                        type="checkbox"
                        checked={selectedRouteIds.includes(item.id)}
                        onChange={() => toggleRouteSelection(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link to={`/routes/${item.id}`}>{item.code}</Link>
                      <div className="helper">ID: {item.id}</div>
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
                    <TableCell colSpan={7}>Sin rutas para los filtros seleccionados.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {items.map((item) => (
              <article key={`mobile-route-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <Link to={`/routes/${item.id}`}>{item.code}</Link>
                    <div className="helper">{item.route_date}</div>
                  </div>
                  <Badge variant="secondary" title={routeStatusHelp(item.status)}>
                    {item.status}
                  </Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Conductor</div>
                    <div>{item.driver_code ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Vehículo</div>
                    <div>{item.vehicle_code ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Paradas</div>
                    <div>{item.stops_count ?? 0}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Selección</div>
                    <div>{selectedRouteIds.includes(item.id) ? 'Seleccionada' : 'Sin seleccionar'}</div>
                  </div>
                </div>
                <div className="mobile-ops-card-actions">
                  <Button type="button" variant="outline" onClick={() => toggleRouteSelection(item.id)}>
                    {selectedRouteIds.includes(item.id) ? 'Quitar' : 'Seleccionar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void quickUpdateRouteStatus(item.id, item.status === 'planned' ? 'in_progress' : 'completed')}
                  >
                    {item.status === 'planned' ? 'Iniciar' : 'Completar'}
                  </Button>
                  <Link to={`/routes/${item.id}`} className="btn btn-outline">Abrir</Link>
                </div>
              </article>
            ))}
            {items.length === 0 ? (
              <div className="mobile-ops-empty">Sin rutas para los filtros seleccionados.</div>
            ) : null}
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
