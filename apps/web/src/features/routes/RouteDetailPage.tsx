import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DriverSummary, PickupSummary, RouteStopSummary, RouteSummary, ShipmentSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function RouteDetailPage() {
  const { id } = useParams();
  const [stops, setStops] = useState<RouteStopSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [pickups, setPickups] = useState<PickupSummary[]>([]);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [subcontractorId, setSubcontractorId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeStatus, setRouteStatus] = useState('planned');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stopType, setStopType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [shipmentQuery, setShipmentQuery] = useState('');
  const [pickupQuery, setPickupQuery] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [selectedPickupId, setSelectedPickupId] = useState('');
  const [stopSequence, setStopSequence] = useState(1);
  const [savingStop, setSavingStop] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError('');
    apiClient.getRouteStops(id).then(setStops).catch(() => setStops([]));
    apiClient.getSubcontractors({ limit: 100 }).then(setSubcontractors).catch(() => setSubcontractors([]));
    apiClient.getShipments({ status: 'created', perPage: 100, page: 1 }).then((result) => setShipments(result.data)).catch(() => setShipments([]));
    apiClient.getPickups({ status: 'planned', limit: 100 }).then(setPickups).catch(() => setPickups([]));
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
  const filteredShipments = shipments.filter((item) => {
    if (!shipmentQuery) return true;
    const query = shipmentQuery.toLowerCase();
    return item.reference.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
  });
  const filteredPickups = pickups.filter((item) => {
    if (!pickupQuery) return true;
    const query = pickupQuery.toLowerCase();
    return item.reference.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
  });

  const saveVehicleAssignment = async () => {
    if (!id) return;
    const selectedDriver = driverId ? drivers.find((item) => item.id === driverId) : null;
    const selectedVehicle = vehicleId ? vehicles.find((item) => item.id === vehicleId) : null;
    if (subcontractorId && selectedDriver?.subcontractor_id && selectedDriver.subcontractor_id !== subcontractorId) {
      setError('El conductor seleccionado no pertenece a la subcontrata elegida.');
      return;
    }
    if (subcontractorId && selectedVehicle?.subcontractor_id && selectedVehicle.subcontractor_id !== subcontractorId) {
      setError('El vehiculo seleccionado no pertenece a la subcontrata elegida.');
      return;
    }
    if (selectedDriver && selectedVehicle?.assigned_driver_id && selectedVehicle.assigned_driver_id !== selectedDriver.id) {
      setError('El vehiculo esta asignado a otro conductor.');
      return;
    }
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
    const stopEntityId = stopType === 'DELIVERY' ? selectedShipmentId : selectedPickupId;
    if (!id || !stopEntityId) {
      setError(`Debes seleccionar ${stopType === 'DELIVERY' ? 'un envio' : 'una recogida'} para la parada.`);
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
      setSelectedShipmentId('');
      setSelectedPickupId('');
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

  const deleteStop = async (stopId: string) => {
    if (!id) return;
    setError('');
    try {
      const updatedStops = await apiClient.deleteRouteStop(id, stopId);
      setStops(updatedStops);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo eliminar la parada');
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
            {stopType === 'DELIVERY' ? (
              <>
                <input
                  id="stop-entity-search"
                  value={shipmentQuery}
                  onChange={(event) => setShipmentQuery(event.target.value)}
                  placeholder="Buscar envio por referencia o ID"
                />
                <select id="stop-entity-id" value={selectedShipmentId} onChange={(event) => setSelectedShipmentId(event.target.value)}>
                  <option value="">Selecciona envio</option>
                  {filteredShipments.map((shipment) => (
                    <option key={shipment.id} value={shipment.id}>
                      {shipment.reference} ({shipment.status})
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <input
                  id="stop-entity-search"
                  value={pickupQuery}
                  onChange={(event) => setPickupQuery(event.target.value)}
                  placeholder="Buscar recogida por referencia o ID"
                />
                <select id="stop-entity-id" value={selectedPickupId} onChange={(event) => setSelectedPickupId(event.target.value)}>
                  <option value="">Selecciona recogida</option>
                  {filteredPickups.map((pickup) => (
                    <option key={pickup.id} value={pickup.id}>
                      {pickup.reference} ({pickup.pickup_type})
                    </option>
                  ))}
                </select>
              </>
            )}
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
                        <Button type="button" variant="outline" onClick={() => deleteStop(stop.id)}>
                          Eliminar
                        </Button>
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
