import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DriverSummary, RouteStopSummary, RouteSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function RouteDetailPage() {
  const { id } = useParams();
  const [stops, setStops] = useState<RouteStopSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [subcontractorId, setSubcontractorId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeStatus, setRouteStatus] = useState('planned');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stopType, setStopType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [stopEntityId, setStopEntityId] = useState('');
  const [stopSequence, setStopSequence] = useState(1);
  const [savingStop, setSavingStop] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError('');
    apiClient.getRouteStops(id).then(setStops).catch(() => setStops([]));
    apiClient.getSubcontractors({ limit: 100 }).then(setSubcontractors).catch(() => setSubcontractors([]));
    apiClient
      .getDrivers({ status: 'active', limit: 100 })
      .then(setDrivers)
      .catch(() => setDrivers([]));
    apiClient
      .getVehicles({ status: 'active', limit: 100 })
      .then(setVehicles)
      .catch(() => setVehicles([]));
    apiClient
      .getRoutes({ page: 1, perPage: 100, sort: 'route_date', dir: 'desc' })
      .then((result) => {
        const selected = result.data.find((item) => item.id === id) ?? null;
        setRoute(selected);
        setSubcontractorId(selected?.subcontractor_id ?? '');
        setDriverId(selected?.driver_id ?? '');
        setVehicleId(selected?.vehicle_id ?? '');
        setRouteStatus(selected?.status ?? 'planned');
      })
      .catch(() => {
        setRoute(null);
        setSubcontractorId('');
        setDriverId('');
        setVehicleId('');
        setRouteStatus('planned');
      });
  }, [id]);

  const filteredDrivers = subcontractorId
    ? drivers.filter((item) => !item.subcontractor_id || item.subcontractor_id === subcontractorId)
    : drivers;

  const filteredVehicles = subcontractorId
    ? vehicles.filter((item) => !item.subcontractor_id || item.subcontractor_id === subcontractorId)
    : vehicles;

  const saveVehicleAssignment = async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const updated = await apiClient.updateRoute(id, {
        subcontractor_id: subcontractorId || null,
        driver_id: driverId || null,
        vehicle_id: vehicleId || null,
        status: routeStatus,
      });
      setRoute(updated);
      setSubcontractorId(updated.subcontractor_id ?? '');
      setDriverId(updated.driver_id ?? '');
      setVehicleId(updated.vehicle_id ?? '');
      setRouteStatus(updated.status ?? 'planned');
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo actualizar la ruta');
    } finally {
      setSaving(false);
    }
  };

  const createStop = async () => {
    if (!id || !stopEntityId) {
      setError('Debes indicar el ID de envio/recogida para la parada.');
      return;
    }
    setSavingStop(true);
    setError('');
    try {
      const created = await apiClient.createRouteStop(id, {
        sequence: stopSequence,
        stop_type: stopType,
        shipment_id: stopType === 'DELIVERY' ? stopEntityId : null,
        pickup_id: stopType === 'PICKUP' ? stopEntityId : null,
        status: 'planned',
      });
      setStops((current) => [...current, created].sort((a, b) => a.sequence - b.sequence));
      setStopEntityId('');
      setStopSequence((value) => value + 1);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo crear la parada');
    } finally {
      setSavingStop(false);
    }
  };

  const updateStop = async (stopId: string, payload: { sequence?: number; status?: 'planned' | 'in_progress' | 'completed' }) => {
    if (!id) return;
    setError('');
    try {
      const updated = await apiClient.updateRouteStop(id, stopId, payload);
      setStops((current) =>
        current
          .map((stop) => (stop.id === stopId ? { ...stop, ...updated } : stop))
          .sort((a, b) => a.sequence - b.sequence)
      );
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo actualizar la parada');
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Asignaciones de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <label htmlFor="route-subcontractor">Subcontrata</label>
            <select id="route-subcontractor" value={subcontractorId} onChange={(event) => setSubcontractorId(event.target.value)}>
              <option value="">Sin asignar</option>
              {subcontractors.map((subcontractor) => (
                <option key={subcontractor.id} value={subcontractor.id}>
                  {subcontractor.legal_name}
                </option>
              ))}
            </select>
            <label htmlFor="route-driver">Conductor</label>
            <select id="route-driver" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
              <option value="">Sin asignar</option>
              {filteredDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.code} - {driver.name}
                </option>
              ))}
            </select>
            <label htmlFor="route-vehicle">Vehiculo</label>
            <select id="route-vehicle" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              <option value="">Sin asignar</option>
              {filteredVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.code} {vehicle.plate_number ? `(${vehicle.plate_number})` : ''}
                </option>
              ))}
            </select>
            <label htmlFor="route-status">Estado</label>
            <select id="route-status" value={routeStatus} onChange={(event) => setRouteStatus(event.target.value)}>
              <option value="planned">planned</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
            </select>
            <Button type="button" onClick={saveVehicleAssignment} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
          <div className="helper">
            Ruta: {route?.code ?? id}
            {' | '}Conductor actual: {route?.driver_code ?? 'Sin asignar'}
            {' | '}Vehiculo actual: {route?.vehicle_code ?? 'Sin asignar'}
          </div>
          {error ? <div className="helper">{error}</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Paradas de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <label htmlFor="stop-type">Tipo</label>
            <select id="stop-type" value={stopType} onChange={(event) => setStopType(event.target.value as 'DELIVERY' | 'PICKUP')}>
              <option value="DELIVERY">DELIVERY</option>
              <option value="PICKUP">PICKUP</option>
            </select>
            <label htmlFor="stop-sequence">Secuencia</label>
            <input
              id="stop-sequence"
              type="number"
              min={1}
              value={stopSequence}
              onChange={(event) => setStopSequence(Number(event.target.value) || 1)}
            />
            <label htmlFor="stop-entity-id">{stopType === 'DELIVERY' ? 'Shipment ID' : 'Pickup ID'}</label>
            <input
              id="stop-entity-id"
              value={stopEntityId}
              onChange={(event) => setStopEntityId(event.target.value)}
              placeholder={stopType === 'DELIVERY' ? 'uuid shipment' : 'uuid pickup'}
            />
            <Button type="button" onClick={createStop} disabled={savingStop}>
              {savingStop ? 'Creando...' : 'Agregar parada'}
            </Button>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Secuencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stops.map((stop) => (
                  <TableRow key={stop.id}>
                    <TableCell>{stop.sequence}</TableCell>
                    <TableCell>{stop.stop_type}</TableCell>
                    <TableCell>{stop.reference ?? stop.entity_id}</TableCell>
                    <TableCell>{stop.entity_type}</TableCell>
                    <TableCell><Badge variant="secondary">{stop.status}</Badge></TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button type="button" variant="outline" onClick={() => updateStop(stop.id, { sequence: Math.max(1, stop.sequence - 1) })}>
                          Subir
                        </Button>
                        <Button type="button" variant="outline" onClick={() => updateStop(stop.id, { sequence: stop.sequence + 1 })}>
                          Bajar
                        </Button>
                        <select
                          value={stop.status}
                          onChange={(event) => updateStop(stop.id, { status: event.target.value as 'planned' | 'in_progress' | 'completed' })}
                        >
                          <option value="planned">planned</option>
                          <option value="in_progress">in_progress</option>
                          <option value="completed">completed</option>
                        </select>
                      </div>
                    </TableCell>
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
