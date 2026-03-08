import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DriverSummary, PickupSummary, RouteManifest, RouteStopSummary, RouteSummary, ShipmentSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function stopStatusHelp(status: string): string {
  const help: Record<string, string> = {
    planned: 'Planificada, pendiente de inicio.',
    in_progress: 'En curso, en ejecución.',
    completed: 'Finalizada y cerrada.',
  };
  return help[status] ?? status;
}

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
  const [assignmentConflicts, setAssignmentConflicts] = useState<string[]>([]);
  const [assignmentWarnings, setAssignmentWarnings] = useState<string[]>([]);
  const [recommendedSubcontractorId, setRecommendedSubcontractorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stopType, setStopType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [shipmentQuery, setShipmentQuery] = useState('');
  const [pickupQuery, setPickupQuery] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [selectedPickupId, setSelectedPickupId] = useState('');
  const [stopSequence, setStopSequence] = useState(1);
  const [savingStop, setSavingStop] = useState(false);
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null);
  const [reorderingStops, setReorderingStops] = useState(false);
  const [bulkShipmentIds, setBulkShipmentIds] = useState<string[]>([]);
  const [bulkPickupIds, setBulkPickupIds] = useState<string[]>([]);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [manifest, setManifest] = useState<RouteManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestNotes, setManifestNotes] = useState('');
  const [manifestSaving, setManifestSaving] = useState(false);
  const [lastDeletedStop, setLastDeletedStop] = useState<RouteStopSummary | null>(null);
  const [undoDeleting, setUndoDeleting] = useState(false);
  const [sequenceDrafts, setSequenceDrafts] = useState<Record<string, number>>({});
  const [recalculatingEta, setRecalculatingEta] = useState(false);

  const refreshManifest = async (routeId: string) => {
    setManifestLoading(true);
    try {
      const data = await apiClient.getRouteManifest(routeId);
      setManifest(data);
      setManifestNotes(data.route.manifest_notes ?? '');
    } catch {
      setManifest(null);
      setManifestNotes('');
    } finally {
      setManifestLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setError('');
    apiClient.getRouteStops(id).then(setStops).catch(() => setStops([]));
    apiClient.getSubcontractors({ limit: 100 }).then(setSubcontractors).catch(() => setSubcontractors([]));
    apiClient.getShipments({ perPage: 100, page: 1 }).then((result) => setShipments(result.data)).catch(() => setShipments([]));
    apiClient.getPickups({ status: 'planned', limit: 100 }).then(setPickups).catch(() => setPickups([]));
    void refreshManifest(id);
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
    const preview = await apiClient.previewRouteAssignment({
      subcontractor_id: subcontractorId || null,
      driver_id: driverId || null,
      vehicle_id: vehicleId || null,
      route_id: id,
      route_date: route?.route_date ?? null,
    });
    setAssignmentConflicts(preview.conflicts.map((item) => item.message));
    setAssignmentWarnings((preview.warnings ?? []).map((item) => item.message));
    setRecommendedSubcontractorId(preview.recommended_subcontractor_id ?? null);
    if (!preview.valid) {
      setError('Corrige las inconsistencias de asignacion antes de guardar.');
      return;
    }

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

  useEffect(() => {
    if (!driverId && !vehicleId && !subcontractorId) {
      setAssignmentConflicts([]);
      setAssignmentWarnings([]);
      setRecommendedSubcontractorId(null);
      return;
    }
    apiClient.previewRouteAssignment({
      subcontractor_id: subcontractorId || null,
      driver_id: driverId || null,
      vehicle_id: vehicleId || null,
      route_id: id,
      route_date: route?.route_date ?? null,
    })
      .then((preview) => {
        setAssignmentConflicts(preview.conflicts.map((item) => item.message));
        setAssignmentWarnings((preview.warnings ?? []).map((item) => item.message));
        setRecommendedSubcontractorId(preview.recommended_subcontractor_id ?? null);
      })
      .catch(() => {
        setAssignmentConflicts([]);
        setAssignmentWarnings([]);
        setRecommendedSubcontractorId(null);
      });
  }, [id, subcontractorId, driverId, vehicleId, route?.route_date]);

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
      void refreshManifest(id);
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

  const persistStopOrder = async (nextStops: RouteStopSummary[]) => {
    if (!id) return;
    setReorderingStops(true);
    setError('');
    try {
      const saved = await apiClient.reorderRouteStops(id, nextStops.map((stop) => stop.id));
      setStops(saved);
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo guardar el nuevo orden de paradas');
      apiClient.getRouteStops(id).then(setStops).catch(() => {});
    } finally {
      setReorderingStops(false);
    }
  };

  const moveStopByDrop = (targetStopId: string) => {
    if (!draggingStopId || draggingStopId === targetStopId || reorderingStops) {
      return;
    }
    const fromIndex = stops.findIndex((stop) => stop.id === draggingStopId);
    const toIndex = stops.findIndex((stop) => stop.id === targetStopId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    const reordered = stops.slice();
    const [dragged] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, dragged);
    const normalized = reordered.map((stop, index) => ({ ...stop, sequence: index + 1 }));
    setStops(normalized);
    void persistStopOrder(normalized);
  };

  const moveStopByOffset = (stopId: string, offset: number) => {
    if (reorderingStops || offset === 0) return;
    const fromIndex = stops.findIndex((stop) => stop.id === stopId);
    if (fromIndex < 0) return;
    const toIndex = fromIndex + offset;
    if (toIndex < 0 || toIndex >= stops.length) return;

    const reordered = stops.slice();
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const normalized = reordered.map((stop, index) => ({ ...stop, sequence: index + 1 }));
    setStops(normalized);
    void persistStopOrder(normalized);
  };

  const bulkAddStops = async () => {
    if (!id) return;
    if (bulkShipmentIds.length === 0 && bulkPickupIds.length === 0) {
      setError('Selecciona al menos un envio o una recogida para carga masiva.');
      return;
    }
    setBulkAdding(true);
    setError('');
    try {
      const result = await apiClient.bulkAddRouteStops(id, {
        shipment_ids: bulkShipmentIds,
        pickup_ids: bulkPickupIds,
        status: 'planned',
      });
      setStops(result.stops);
      setBulkShipmentIds([]);
      setBulkPickupIds([]);
      void refreshManifest(id);
      if (result.skipped_existing_count > 0) {
        setError(`Se omitieron ${result.skipped_existing_count} paradas ya existentes en la ruta.`);
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo agregar paradas en bloque');
    } finally {
      setBulkAdding(false);
    }
  };

  const deleteStop = async (stopId: string) => {
    if (!id) return;
    const target = stops.find((stop) => stop.id === stopId);
    if (!target) return;
    const confirmed = window.confirm(`Eliminar parada ${target.reference ?? target.id}?`);
    if (!confirmed) return;
    setError('');
    try {
      const updatedStops = await apiClient.deleteRouteStop(id, stopId);
      setStops(updatedStops);
      setLastDeletedStop(target);
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo eliminar la parada');
    }
  };

  const undoDeleteStop = async () => {
    if (!id || !lastDeletedStop) return;
    setUndoDeleting(true);
    setError('');
    try {
      const recreated = await apiClient.createRouteStop(id, {
        sequence: stops.length + 1,
        stop_type: lastDeletedStop.stop_type,
        shipment_id: lastDeletedStop.shipment_id ?? null,
        pickup_id: lastDeletedStop.pickup_id ?? null,
        status: lastDeletedStop.status as 'planned' | 'in_progress' | 'completed',
        undo_of_stop_id: lastDeletedStop.id,
      });
      const merged = [...stops, recreated];
      const targetIndex = Math.max(0, Math.min(merged.length - 1, lastDeletedStop.sequence - 1));
      const recreatedIndex = merged.findIndex((stop) => stop.id === recreated.id);
      const reordered = merged.slice();
      const [item] = reordered.splice(recreatedIndex, 1);
      reordered.splice(targetIndex, 0, item);
      const saved = await apiClient.reorderRouteStops(id, reordered.map((stop) => stop.id));
      setStops(saved);
      setLastDeletedStop(null);
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo deshacer la eliminacion');
    } finally {
      setUndoDeleting(false);
    }
  };

  const exportManifestCsv = async () => {
    if (!id) return;
    setError('');
    try {
      await apiClient.exportRouteManifestCsv(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo exportar el manifiesto CSV');
    }
  };

  const exportManifestPdf = async () => {
    if (!id) return;
    setError('');
    try {
      await apiClient.exportRouteManifestPdf(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo exportar el manifiesto PDF');
    }
  };

  const saveManifestNotes = async () => {
    if (!id) return;
    setManifestSaving(true);
    setError('');
    try {
      const saved = await apiClient.updateRouteManifest(id, {
        manifest_notes: manifestNotes.trim() === '' ? null : manifestNotes,
      });
      setManifestNotes(saved.manifest_notes ?? '');
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo actualizar las notas de manifest');
    } finally {
      setManifestSaving(false);
    }
  };

  const toLocalDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const toIsoDateTime = (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const etaSuggestions = useMemo(() => {
    const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
    if (!route?.route_date) return {} as Record<string, string>;
    const start = new Date(`${route.route_date}T08:00:00`);
    if (Number.isNaN(start.getTime())) return {} as Record<string, string>;
    let cursor = start.getTime();
    const suggestions: Record<string, string> = {};
    sorted.forEach((stop) => {
      suggestions[stop.id] = new Date(cursor).toISOString();
      const serviceMinutes = stop.stop_type === 'PICKUP' ? 6 : 4;
      cursor += (8 + serviceMinutes) * 60 * 1000;
    });
    return suggestions;
  }, [route?.route_date, stops]);

  const applySuggestedEta = async () => {
    if (!id || stops.length === 0) return;
    setRecalculatingEta(true);
    setError('');
    try {
      const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
      for (const stop of sorted) {
        const plannedAt = etaSuggestions[stop.id];
        if (!plannedAt) continue;
        await apiClient.updateRouteStop(id, stop.id, { planned_at: plannedAt });
      }
      const refreshed = await apiClient.getRouteStops(id);
      setStops(refreshed);
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo recalcular ETA');
    } finally {
      setRecalculatingEta(false);
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
          {assignmentConflicts.length > 0 ? <div className="helper error">{assignmentConflicts.join(' ')}</div> : null}
          {assignmentWarnings.length > 0 ? <div className="helper">{assignmentWarnings.join(' ')}</div> : null}
          {recommendedSubcontractorId && !subcontractorId ? (
            <div className="helper">Sugerencia: subcontrata recomendada {recommendedSubcontractorId}</div>
          ) : null}
          {error ? <div className="helper">{error}</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Paradas de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <strong>Manifest:</strong>
            {manifestLoading ? (
              <span className="helper">Cargando...</span>
            ) : (
              <span className="helper">
                Stops {manifest?.totals.stops ?? stops.length} | Deliveries {manifest?.totals.deliveries ?? 0}
                {' | '}Pickups {manifest?.totals.pickups ?? 0} | Completed {manifest?.totals.completed ?? 0}
              </span>
            )}
            <Button type="button" variant="outline" disabled={!id} onClick={() => void exportManifestCsv()}>
              Export CSV
            </Button>
            <Button type="button" variant="outline" disabled={!id} onClick={() => void exportManifestPdf()}>
              Export PDF
            </Button>
          </div>
          <div className="inline-actions">
            <label htmlFor="manifest-notes">Notas manifest</label>
            <textarea
              id="manifest-notes"
              value={manifestNotes}
              onChange={(event) => setManifestNotes(event.target.value)}
              placeholder="Notas operativas para la ruta"
              rows={2}
            />
            <Button type="button" onClick={saveManifestNotes} disabled={manifestSaving || !id}>
              {manifestSaving ? 'Guardando...' : 'Guardar notas'}
            </Button>
          </div>
          <div className="inline-actions">
            <strong>Bulk add:</strong>
            <label htmlFor="bulk-shipment-ids">Envios</label>
            <select
              id="bulk-shipment-ids"
              multiple
              value={bulkShipmentIds}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                setBulkShipmentIds(values);
              }}
            >
              {filteredShipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.reference} ({shipment.status})
                </option>
              ))}
            </select>
            <label htmlFor="bulk-pickup-ids">Recogidas</label>
            <select
              id="bulk-pickup-ids"
              multiple
              value={bulkPickupIds}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                setBulkPickupIds(values);
              }}
            >
              {filteredPickups.map((pickup) => (
                <option key={pickup.id} value={pickup.id}>
                  {pickup.reference} ({pickup.pickup_type})
                </option>
              ))}
            </select>
            <Button type="button" onClick={bulkAddStops} disabled={bulkAdding}>
              {bulkAdding ? 'Agregando...' : 'Agregar seleccionados'}
            </Button>
          </div>
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
            {lastDeletedStop ? (
              <Button type="button" variant="outline" disabled={undoDeleting} onClick={undoDeleteStop}>
                {undoDeleting ? 'Revirtiendo...' : 'Deshacer eliminacion'}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={applySuggestedEta} disabled={recalculatingEta || reorderingStops || !route}>
              {recalculatingEta ? 'Recalculando ETA...' : 'Recalcular ETA'}
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
                  <TableHead>ETA sugerida</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stops.map((stop, index) => (
                  <TableRow
                    key={stop.id}
                    draggable={!reorderingStops}
                    onDragStart={() => setDraggingStopId(stop.id)}
                    onDragEnd={() => setDraggingStopId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      moveStopByDrop(stop.id);
                      setDraggingStopId(null);
                    }}
                  >
                    <TableCell>
                      <input
                        type="number"
                        min={1}
                        value={sequenceDrafts[stop.id] ?? stop.sequence}
                        onChange={(event) => {
                          const value = Number(event.target.value) || 1;
                          setSequenceDrafts((current) => ({ ...current, [stop.id]: value }));
                        }}
                        onBlur={() => {
                          const next = sequenceDrafts[stop.id];
                          if (next && next !== stop.sequence) {
                            updateStop(stop.id, { sequence: next });
                          }
                          setSequenceDrafts((current) => {
                            const { [stop.id]: _ignored, ...rest } = current;
                            return rest;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>{stop.stop_type}</TableCell>
                    <TableCell>{stop.reference ?? stop.entity_id}</TableCell>
                    <TableCell>{stop.entity_type}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" title={stopStatusHelp(stop.status)}>
                        {stop.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{toLocalDateTime(etaSuggestions[stop.id]) || '-'}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={reorderingStops || index === 0}
                          onClick={() => moveStopByOffset(stop.id, -1)}
                        >
                          Subir
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={reorderingStops || index === stops.length - 1}
                          onClick={() => moveStopByOffset(stop.id, 1)}
                        >
                          Bajar
                        </Button>
                        <select
                          disabled={reorderingStops}
                          value={stop.status}
                          onChange={(event) => updateStop(stop.id, { status: event.target.value as 'planned' | 'in_progress' | 'completed' })}
                        >
                          <option value="planned">planned</option>
                          <option value="in_progress">in_progress</option>
                          <option value="completed">completed</option>
                        </select>
                        <input
                          type="datetime-local"
                          value={toLocalDateTime(stop.planned_at)}
                          onChange={(event) => {
                            const iso = toIsoDateTime(event.target.value);
                            updateStop(stop.id, { planned_at: iso });
                          }}
                        />
                        <input
                          type="datetime-local"
                          value={toLocalDateTime(stop.completed_at)}
                          onChange={(event) => {
                            const iso = toIsoDateTime(event.target.value);
                            updateStop(stop.id, { completed_at: iso });
                          }}
                        />
                        <Button type="button" variant="outline" disabled={reorderingStops} onClick={() => deleteStop(stop.id)}>
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="helper">
            Arrastra y suelta una fila para reordenar paradas. {reorderingStops ? 'Guardando orden...' : ''}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
