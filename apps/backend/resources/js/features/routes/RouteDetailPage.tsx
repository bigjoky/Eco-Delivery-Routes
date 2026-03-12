import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityActivityTimeline } from '../../components/audit/EntityActivityTimeline';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ExportActionsModal } from '../../components/common/ExportActionsModal';
import { Modal } from '../../components/ui/modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DriverSummary, ExpeditionSummary, PickupSummary, RouteManifest, RouteStopSummary, RouteSummary, ShipmentSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { hasExportAccess } from '../../core/auth/exportAccess';
import { apiClient } from '../../services/apiClient';
import { routeBulkReasonOptions, RouteBulkReasonCode, validateRouteBulkUpdate } from './routeBulkValidation';

function stopStatusHelp(status: string): string {
  const help: Record<string, string> = {
    planned: 'Planificada, pendiente de inicio.',
    in_progress: 'En curso, en ejecución.',
    completed: 'Finalizada y cerrada.',
  };
  return help[status] ?? status;
}

function routeStopTypeLabel(value: 'DELIVERY' | 'PICKUP') {
  return value === 'PICKUP' ? 'Recogida' : 'Entrega';
}

function routeServiceTypeLabel(value?: string | null) {
  if (!value) return '-';
  const labels: Record<string, string> = {
    express_1030: 'Express 10:30',
    express_1400: 'Express 14:00',
    express_1900: 'Express 19:00',
    economy_parcel: 'Economy Parcel',
    business_parcel: 'Business Parcel',
    thermo_parcel: 'Thermo Parcel',
  };
  return labels[value] ?? value;
}

function routeOperationKindLabel(value?: 'shipment' | 'return' | null) {
  if (value === 'return') return 'Devolución';
  if (value === 'shipment') return 'Envío';
  return '-';
}

type RouteBulkActionTemplate = {
  id: string;
  name: string;
  status: '' | 'planned' | 'in_progress' | 'completed';
  plannedAt: string;
  completedAt: string;
  shiftMinutes: string;
  reasonCode: RouteBulkReasonCode;
  reasonDetail: string;
};

type RouteOpsAuditItem = {
  id: string;
  at: string;
  action: string;
  details: string;
};

export function RouteDetailPage() {
  const { id } = useParams();
  const canExport = hasExportAccess('routes', sessionStore.getRoles());
  const [stops, setStops] = useState<RouteStopSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [pickups, setPickups] = useState<PickupSummary[]>([]);
  const [expeditions, setExpeditions] = useState<ExpeditionSummary[]>([]);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [subcontractorId, setSubcontractorId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeStatus, setRouteStatus] = useState('planned');
  const [assignmentConflicts, setAssignmentConflicts] = useState<string[]>([]);
  const [assignmentWarnings, setAssignmentWarnings] = useState<string[]>([]);
  const [recommendedSubcontractorId, setRecommendedSubcontractorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [smartAssigning, setSmartAssigning] = useState(false);
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
  const [bulkExpeditionIds, setBulkExpeditionIds] = useState<string[]>([]);
  const [expeditionQuery, setExpeditionQuery] = useState('');
  const [showAdvancedLegSelectors, setShowAdvancedLegSelectors] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
  const [bulkDeletingStops, setBulkDeletingStops] = useState(false);
  const [bulkUpdatingStops, setBulkUpdatingStops] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<'' | 'planned' | 'in_progress' | 'completed'>('');
  const [bulkPlannedAt, setBulkPlannedAt] = useState('');
  const [bulkCompletedAt, setBulkCompletedAt] = useState('');
  const [bulkEtaShiftMinutes, setBulkEtaShiftMinutes] = useState('0');
  const [bulkReasonCode, setBulkReasonCode] = useState<RouteBulkReasonCode>('WEB_BULK_UPDATE');
  const [bulkReasonDetail, setBulkReasonDetail] = useState('');
  const [manifest, setManifest] = useState<RouteManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestNotes, setManifestNotes] = useState('');
  const [manifestSaving, setManifestSaving] = useState(false);
  const [lastDeletedStop, setLastDeletedStop] = useState<RouteStopSummary | null>(null);
  const [undoDeleting, setUndoDeleting] = useState(false);
  const [sequenceDrafts, setSequenceDrafts] = useState<Record<string, number>>({});
  const [recalculatingEta, setRecalculatingEta] = useState(false);
  const [bulkUpdatePreviewOpen, setBulkUpdatePreviewOpen] = useState(false);
  const [bulkUpdatePreviewRows, setBulkUpdatePreviewRows] = useState<Array<{ id: string; reference: string; changes: string[] }>>([]);
  const [bulkTemplateName, setBulkTemplateName] = useState('');
  const [selectedBulkTemplateId, setSelectedBulkTemplateId] = useState('');
  const [selectedBulkTemplateName, setSelectedBulkTemplateName] = useState('');
  const [bulkTemplates, setBulkTemplates] = useState<RouteBulkActionTemplate[]>([]);
  const [opsAudit, setOpsAudit] = useState<RouteOpsAuditItem[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const routeBulkTemplateStorageKey = `eco_delivery_routes_route_bulk_templates_${id ?? 'global'}`;
  const routeOpsAuditStorageKey = `eco_delivery_routes_route_ops_audit_${id ?? 'global'}`;

  const appendOpsAudit = (action: string, details: string) => {
    const entry: RouteOpsAuditItem = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      action,
      details,
    };
    setOpsAudit((current) => [entry, ...current].slice(0, 30));
  };

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
    apiClient.getExpeditions({ limit: 100 }).then(setExpeditions).catch(() => setExpeditions([]));
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
  const filteredExpeditions = expeditions.filter((item) => {
    if (!expeditionQuery) return true;
    const query = expeditionQuery.toLowerCase();
    return (
      item.reference.toLowerCase().includes(query)
      || (item.shipment_reference ?? '').toLowerCase().includes(query)
      || (item.pickup_reference ?? '').toLowerCase().includes(query)
      || (item.sender_name ?? '').toLowerCase().includes(query)
      || (item.recipient_name ?? '').toLowerCase().includes(query)
    );
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

  const suggestSmartAssignment = async () => {
    if (!id) return;
    setSmartAssigning(true);
    setError('');
    try {
      const activeSubcontractors = subcontractors.filter((item) => item.status === 'active');
      const orderedSubcontractorIds = Array.from(
        new Set([
          subcontractorId || null,
          recommendedSubcontractorId || null,
          route?.subcontractor_id ?? null,
          ...activeSubcontractors.map((item) => item.id),
          null,
        ])
      );

      let attempts = 0;
      const maxAttempts = 40;
      for (const candidateSubcontractorId of orderedSubcontractorIds) {
        const candidateDrivers = drivers
          .filter((driver) => driver.status === 'active')
          .filter((driver) => !candidateSubcontractorId || driver.subcontractor_id === candidateSubcontractorId)
          .slice(0, 10);
        const candidateVehicles = vehicles
          .filter((vehicle) => vehicle.status === 'active')
          .filter((vehicle) => !candidateSubcontractorId || vehicle.subcontractor_id === candidateSubcontractorId)
          .slice(0, 10);

        for (const driver of candidateDrivers) {
          for (const vehicle of candidateVehicles) {
            if (vehicle.assigned_driver_id && vehicle.assigned_driver_id !== driver.id) continue;
            attempts += 1;
            const preview = await apiClient.previewRouteAssignment({
              subcontractor_id: candidateSubcontractorId || null,
              driver_id: driver.id,
              vehicle_id: vehicle.id,
              route_id: id,
              route_date: route?.route_date ?? null,
            });
            if (preview.valid) {
              setSubcontractorId(candidateSubcontractorId || '');
              setDriverId(driver.id);
              setVehicleId(vehicle.id);
              setAssignmentConflicts([]);
              setAssignmentWarnings((preview.warnings ?? []).map((item) => item.message));
              setRecommendedSubcontractorId(preview.recommended_subcontractor_id ?? null);
              setError('');
              return;
            }
            if (attempts >= maxAttempts) break;
          }
          if (attempts >= maxAttempts) break;
        }
        if (attempts >= maxAttempts) break;
      }
      setError('No se encontro combinacion valida automatica. Ajusta manualmente y guarda.');
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo ejecutar asignacion inteligente');
    } finally {
      setSmartAssigning(false);
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

  const updateStop = async (stopId: string, payload: {
    sequence?: number;
    status?: 'planned' | 'in_progress' | 'completed';
    planned_at?: string | null;
    completed_at?: string | null;
  }) => {
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
      appendOpsAudit('stops.reordered', `Reordenadas ${saved.length} paradas.`);
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
    if (bulkExpeditionIds.length === 0 && bulkShipmentIds.length === 0 && bulkPickupIds.length === 0) {
      setError('Selecciona al menos una expedición o una pata operativa para carga masiva.');
      return;
    }
    setBulkAdding(true);
    setError('');
    try {
      const result = await apiClient.bulkAddRouteStops(id, {
        expedition_ids: bulkExpeditionIds,
        shipment_ids: bulkShipmentIds,
        pickup_ids: bulkPickupIds,
        status: 'planned',
      });
      setStops(result.stops);
      appendOpsAudit('stops.bulk_add', `Agregadas ${result.created_count} paradas en lote.`);
      setBulkExpeditionIds([]);
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

  const deleteSelectedStops = async () => {
    if (!id) return;
    if (selectedStopIds.length === 0) {
      setError('Selecciona al menos una parada para eliminar.');
      return;
    }
    const confirmed = window.confirm(`Eliminar ${selectedStopIds.length} paradas seleccionadas?`);
    if (!confirmed) return;

    setBulkDeletingStops(true);
    setError('');
    try {
      let updatedStops = stops;
      for (const stopId of selectedStopIds) {
        updatedStops = await apiClient.deleteRouteStop(id, stopId);
      }
      setStops(updatedStops);
      appendOpsAudit('stops.bulk_delete', `Eliminadas ${selectedStopIds.length} paradas en lote.`);
      setSelectedStopIds([]);
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo eliminar paradas en bloque');
      apiClient.getRouteStops(id).then(setStops).catch(() => {});
    } finally {
      setBulkDeletingStops(false);
    }
  };

  const buildBulkStopPayload = (current?: RouteStopSummary): {
    status?: 'planned' | 'in_progress' | 'completed';
    planned_at?: string | null;
    completed_at?: string | null;
  } => {
    const shiftMinutes = Number(bulkEtaShiftMinutes);
    const hasShift = Number.isFinite(shiftMinutes) && shiftMinutes !== 0;
    const payload: {
      status?: 'planned' | 'in_progress' | 'completed';
      planned_at?: string | null;
      completed_at?: string | null;
    } = {};
    if (bulkStatus) payload.status = bulkStatus;
    if (bulkPlannedAt) payload.planned_at = toIsoDateTime(bulkPlannedAt);
    if (bulkCompletedAt) payload.completed_at = toIsoDateTime(bulkCompletedAt);
    if (hasShift && current) {
      if (!bulkPlannedAt && current.planned_at) {
        payload.planned_at = shiftIsoDateTime(current.planned_at, shiftMinutes);
      }
      if (!bulkCompletedAt && current.completed_at) {
        payload.completed_at = shiftIsoDateTime(current.completed_at, shiftMinutes);
      }
    }
    if (payload.status === 'completed' && !payload.completed_at) {
      payload.completed_at = new Date().toISOString();
    }
    return payload;
  };

  const openBulkUpdatePreview = () => {
    const shiftMinutes = Number(bulkEtaShiftMinutes);
    const hasShift = Number.isFinite(shiftMinutes) && shiftMinutes !== 0;
    const validationError = validateRouteBulkUpdate({
      selectedCount: selectedStopIds.length,
      hasAnyChange: Boolean(bulkStatus || bulkPlannedAt || bulkCompletedAt || hasShift),
      reasonCode: bulkReasonCode,
      reasonDetail: bulkReasonDetail,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    const rows = selectedStopIds.map((stopId) => {
      const current = stops.find((stop) => stop.id === stopId);
      const payload = buildBulkStopPayload(current);
      const changes: string[] = [];
      if (payload.status) changes.push(`Estado -> ${payload.status}`);
      if (payload.planned_at) changes.push(`ETA planificada -> ${toLocalDateTime(payload.planned_at)}`);
      if (payload.completed_at) changes.push(`ETA completada -> ${toLocalDateTime(payload.completed_at)}`);
      return {
        id: stopId,
        reference: current?.reference ?? current?.entity_id ?? stopId,
        changes: changes.length > 0 ? changes : ['Sin cambios detectados'],
      };
    });
    setBulkUpdatePreviewRows(rows);
    setBulkUpdatePreviewOpen(true);
  };

  const updateSelectedStops = async () => {
    if (!id) return;
    const shiftMinutes = Number(bulkEtaShiftMinutes);
    const hasShift = Number.isFinite(shiftMinutes) && shiftMinutes !== 0;
    const validationError = validateRouteBulkUpdate({
      selectedCount: selectedStopIds.length,
      hasAnyChange: Boolean(bulkStatus || bulkPlannedAt || bulkCompletedAt || hasShift),
      reasonCode: bulkReasonCode,
      reasonDetail: bulkReasonDetail,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setBulkUpdatingStops(true);
    setError('');
    try {
      const payload = buildBulkStopPayload();
      const result = await apiClient.bulkUpdateRouteStops(id, {
        stop_ids: selectedStopIds,
        status: payload.status,
        planned_at: payload.planned_at,
        completed_at: payload.completed_at,
        eta_shift_minutes: hasShift ? shiftMinutes : undefined,
        reason_code: bulkReasonCode,
        reason_detail: bulkReasonDetail.trim() || undefined,
      });
      setStops(result.stops);
      setBulkUpdatePreviewOpen(false);
      appendOpsAudit('stops.bulk_update', `Actualizadas ${result.updated_count} paradas en lote. Motivo: ${bulkReasonCode}.`);
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo actualizar paradas en bloque');
    } finally {
      setBulkUpdatingStops(false);
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

  const localDateTimeNow = () => toLocalDateTime(new Date().toISOString());

  const applyBulkPreset = (preset: 'clear' | 'start_shift' | 'mark_in_progress_now' | 'complete_now' | 'delay_15' | 'delay_30') => {
    if (preset === 'clear') {
      setBulkStatus('');
      setBulkPlannedAt('');
      setBulkCompletedAt('');
      setBulkEtaShiftMinutes('0');
      setBulkReasonCode('WEB_BULK_UPDATE');
      setBulkReasonDetail('');
      return;
    }
    if (preset === 'start_shift') {
      setBulkStatus('planned');
      setBulkPlannedAt(localDateTimeNow());
      setBulkCompletedAt('');
      setBulkEtaShiftMinutes('0');
      return;
    }
    if (preset === 'mark_in_progress_now') {
      setBulkStatus('in_progress');
      setBulkPlannedAt(localDateTimeNow());
      setBulkCompletedAt('');
      setBulkEtaShiftMinutes('0');
      return;
    }
    if (preset === 'complete_now') {
      setBulkStatus('completed');
      setBulkCompletedAt(localDateTimeNow());
      setBulkEtaShiftMinutes('0');
      return;
    }
    if (preset === 'delay_15') {
      setBulkEtaShiftMinutes('15');
      return;
    }
    if (preset === 'delay_30') {
      setBulkEtaShiftMinutes('30');
    }
  };

  const shiftIsoDateTime = (value: string, minutes: number) => {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return value;
    return new Date(parsed + (minutes * 60 * 1000)).toISOString();
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
  const manifestStops = manifest?.stops ?? stops;
  const manifestExpeditionCount = useMemo(
    () => new Set(manifestStops.map((stop) => stop.expedition_reference).filter((value): value is string => Boolean(value))).size,
    [manifestStops]
  );
  const manifestPickupLegs = useMemo(
    () => manifestStops.filter((stop) => stop.stop_type === 'PICKUP').length,
    [manifestStops]
  );
  const manifestDeliveryLegs = useMemo(
    () => manifestStops.filter((stop) => stop.stop_type === 'DELIVERY').length,
    [manifestStops]
  );
  const manifestGroupedByExpedition = useMemo(() => {
    const grouped = new Map<string, {
      expedition_reference: string;
      operation_kind?: 'shipment' | 'return' | null;
      product_category?: 'parcel' | 'thermo' | null;
      pickup?: RouteStopSummary | null;
      delivery?: RouteStopSummary | null;
    }>();

    manifestStops.forEach((stop) => {
      const key = stop.expedition_reference ?? `standalone-${stop.id}`;
      const current = grouped.get(key) ?? {
        expedition_reference: stop.expedition_reference ?? 'Sin expedición',
        operation_kind: stop.operation_kind,
        product_category: stop.product_category,
        pickup: null,
        delivery: null,
      };

      if (stop.stop_type === 'PICKUP') current.pickup = stop;
      if (stop.stop_type === 'DELIVERY') current.delivery = stop;

      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  }, [manifestStops]);

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
      appendOpsAudit('stops.eta_recalculated', `Recalculadas ETA para ${sorted.length} paradas.`);
      void refreshManifest(id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo recalcular ETA');
    } finally {
      setRecalculatingEta(false);
    }
  };

  useEffect(() => {
    const visible = new Set(stops.map((stop) => stop.id));
    setSelectedStopIds((current) => current.filter((id) => visible.has(id)));
  }, [stops]);

  useEffect(() => {
    let cancelled = false;
    apiClient.getRouteBulkTemplates(id).then((rows) => {
      if (cancelled) return;
      setBulkTemplates(rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: (row.status as '' | 'planned' | 'in_progress' | 'completed' | null) ?? '',
        plannedAt: row.planned_at ?? '',
        completedAt: row.completed_at ?? '',
        shiftMinutes: String(row.shift_minutes ?? 0),
        reasonCode: 'WEB_BULK_UPDATE',
        reasonDetail: '',
      })));
    }).catch(() => {
      if (typeof window === 'undefined' || cancelled) return;
      const rawTemplates = window.localStorage.getItem(routeBulkTemplateStorageKey);
      if (rawTemplates) {
        try {
          const parsed = JSON.parse(rawTemplates) as RouteBulkActionTemplate[];
          setBulkTemplates(Array.isArray(parsed) ? parsed.map((item) => ({
            ...item,
            reasonCode: (item.reasonCode as RouteBulkReasonCode | undefined) ?? 'WEB_BULK_UPDATE',
            reasonDetail: item.reasonDetail ?? '',
          })) : []);
        } catch {
          setBulkTemplates([]);
        }
      } else {
        setBulkTemplates([]);
      }
    });
    if (typeof window === 'undefined') return () => {};
    const rawAudit = window.localStorage.getItem(routeOpsAuditStorageKey);
    if (rawAudit) {
      try {
        const parsed = JSON.parse(rawAudit) as RouteOpsAuditItem[];
        setOpsAudit(Array.isArray(parsed) ? parsed : []);
      } catch {
        setOpsAudit([]);
      }
    } else {
      setOpsAudit([]);
    }
    setSelectedBulkTemplateId('');
    return () => {
      cancelled = true;
    };
  }, [id, routeBulkTemplateStorageKey, routeOpsAuditStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(routeBulkTemplateStorageKey, JSON.stringify(bulkTemplates));
  }, [routeBulkTemplateStorageKey, bulkTemplates]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(routeOpsAuditStorageKey, JSON.stringify(opsAudit));
  }, [routeOpsAuditStorageKey, opsAudit]);

  const saveBulkTemplate = async () => {
    if (!bulkTemplateName.trim()) {
      setError('Define nombre de plantilla para guardar acciones masivas.');
      return;
    }
    const template: RouteBulkActionTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: bulkTemplateName.trim(),
      status: bulkStatus,
      plannedAt: bulkPlannedAt,
      completedAt: bulkCompletedAt,
      shiftMinutes: bulkEtaShiftMinutes,
      reasonCode: bulkReasonCode,
      reasonDetail: bulkReasonDetail,
    };
    setBulkTemplates((current) => [template, ...current].slice(0, 20));
    try {
      const saved = await apiClient.createRouteBulkTemplate({
        route_id: id ?? null,
        name: template.name,
        status: template.status || null,
        planned_at: template.plannedAt || null,
        completed_at: template.completedAt || null,
        shift_minutes: Number(template.shiftMinutes) || 0,
      });
      setBulkTemplates((current) => current.map((item) => (item.id === template.id ? { ...item, id: saved.id } : item)));
      setSelectedBulkTemplateId(saved.id);
    } catch {
      setSelectedBulkTemplateId(template.id);
    }
    setBulkTemplateName('');
    appendOpsAudit('template.saved', `Plantilla guardada: ${template.name}`);
  };

  const applyBulkTemplate = () => {
    const template = bulkTemplates.find((item) => item.id === selectedBulkTemplateId);
    if (!template) {
      setError('Selecciona una plantilla válida.');
      return;
    }
    setBulkStatus(template.status);
    setBulkPlannedAt(template.plannedAt);
    setBulkCompletedAt(template.completedAt);
    setBulkEtaShiftMinutes(template.shiftMinutes);
    setBulkReasonCode(template.reasonCode);
    setBulkReasonDetail(template.reasonDetail);
    appendOpsAudit('template.applied', `Plantilla aplicada: ${template.name}`);
  };

  const renameBulkTemplate = async () => {
    const template = bulkTemplates.find((item) => item.id === selectedBulkTemplateId);
    if (!template || !selectedBulkTemplateName.trim()) return;
    setBulkTemplates((current) => current.map((item) => (
      item.id === selectedBulkTemplateId
        ? { ...item, name: selectedBulkTemplateName.trim() }
        : item
    )));
    try {
      await apiClient.updateRouteBulkTemplate(selectedBulkTemplateId, { name: selectedBulkTemplateName.trim() });
    } catch {
      // keep optimistic rename local for now
    }
    appendOpsAudit('template.renamed', `Plantilla renombrada: ${selectedBulkTemplateName.trim()}`);
  };

  const duplicateBulkTemplate = async () => {
    const template = bulkTemplates.find((item) => item.id === selectedBulkTemplateId);
    if (!template) return;
    const tempId = `tpl-copy-${Date.now()}`;
    const optimistic: RouteBulkActionTemplate = {
      ...template,
      id: tempId,
      name: `${template.name} (copia)`,
    };
    setBulkTemplates((current) => [optimistic, ...current].slice(0, 20));
    try {
      const created = await apiClient.duplicateRouteBulkTemplate(selectedBulkTemplateId);
      setBulkTemplates((current) => current.map((item) => (
        item.id === tempId ? { ...item, id: created.id } : item
      )));
      setSelectedBulkTemplateId(created.id);
      setSelectedBulkTemplateName(`${template.name} (copia)`);
    } catch {
      // keep local duplicated template fallback
      setSelectedBulkTemplateId(tempId);
      setSelectedBulkTemplateName(`${template.name} (copia)`);
    }
    appendOpsAudit('template.duplicated', `Plantilla duplicada: ${template.name}`);
  };

  const deleteBulkTemplate = async () => {
    const template = bulkTemplates.find((item) => item.id === selectedBulkTemplateId);
    if (!template) return;
    setBulkTemplates((current) => current.filter((item) => item.id !== selectedBulkTemplateId));
    try {
      await apiClient.deleteRouteBulkTemplate(selectedBulkTemplateId);
    } catch {
      // fallback local only
    }
    setSelectedBulkTemplateId('');
    appendOpsAudit('template.deleted', `Plantilla eliminada: ${template.name}`);
  };

  const exportOpsAuditCsv = () => {
    if (opsAudit.length === 0) return;
    const rows = ['timestamp,action,details'];
    opsAudit.forEach((entry) => {
      const csvValue = (value: string) => `"${value.replaceAll('"', '""')}"`;
      rows.push([
        csvValue(entry.at),
        csvValue(entry.action),
        csvValue(entry.details),
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `route_ops_audit_${route?.code ?? id ?? 'route'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="page-grid">
      <div className="page-header">
        <h1 className="page-title">Detalle de ruta</h1>
        <div className="page-subtitle">Asignación, manifest y control de paradas en una vista operativa unificada.</div>
      </div>
      <Modal
        open={bulkUpdatePreviewOpen}
        onClose={() => setBulkUpdatePreviewOpen(false)}
        title="Previsualización cambios masivos"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setBulkUpdatePreviewOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={updateSelectedStops} disabled={bulkUpdatingStops || bulkUpdatePreviewRows.length === 0}>
              {bulkUpdatingStops ? 'Aplicando...' : `Confirmar (${bulkUpdatePreviewRows.length})`}
            </Button>
          </>
        )}
      >
        <div className="page-grid">
          <div className="modal-section">
            <div className="modal-section-title">Resumen de ejecución</div>
            <div className="modal-section-copy">Se aplicarán cambios a {bulkUpdatePreviewRows.length} parada(s).</div>
            <div className="modal-section-copy">Motivo estructurado: {bulkReasonCode}{bulkReasonDetail.trim() ? ` (${bulkReasonDetail.trim()})` : ''}</div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Detalle de cambios</div>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parada</TableHead>
                  <TableHead>Cambios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkUpdatePreviewRows.slice(0, 20).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.reference}</TableCell>
                    <TableCell>{row.changes.join(' · ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          </div>
          {bulkUpdatePreviewRows.length > 20 ? (
            <div className="helper">Mostrando 20 de {bulkUpdatePreviewRows.length} paradas.</div>
          ) : null}
        </div>
      </Modal>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Asignaciones de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="modal-section">
            <div className="modal-section-title">Contexto de ruta</div>
            <div className="inline-actions">
              <Link to="/dashboard" className="helper">Dashboard</Link>
              <span className="helper">/</span>
              <Link to="/routes" className="btn btn-outline">Rutas</Link>
              {route?.subcontractor_id ? (
                <Link to={`/partners?focus=subcontractor&id=${encodeURIComponent(route.subcontractor_id)}`} className="btn btn-outline">Subcontrata</Link>
              ) : null}
              {route?.driver_id ? (
                <Link to={`/partners?focus=driver&id=${encodeURIComponent(route.driver_id)}`} className="btn btn-outline">Conductor</Link>
              ) : null}
              {route?.vehicle_id ? (
                <Link to={`/fleet-controls?vehicle_id=${encodeURIComponent(route.vehicle_id)}`} className="btn btn-outline">Flota</Link>
              ) : null}
            </div>
            <div className="modal-section-copy">
              Ruta: {route?.code ?? id}
              {' | '}ID: {route?.id ?? id}
              {' | '}Conductor actual: {route?.driver_code ?? 'Sin asignar'}
              {' | '}Vehiculo actual: {route?.vehicle_code ?? 'Sin asignar'}
            </div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Asignación operativa</div>
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
            <Button type="button" variant="outline" onClick={suggestSmartAssignment} disabled={smartAssigning || saving}>
              {smartAssigning ? 'Buscando...' : 'Asignacion inteligente'}
            </Button>
          </div>
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
          <div className="modal-section">
            <div className="modal-section-title">Manifest y exportación</div>
          <div className="inline-actions">
            <strong>Manifest:</strong>
            {manifestLoading ? (
              <span className="helper">Cargando...</span>
            ) : (
              <span className="helper">
                Expediciones {manifestExpeditionCount} | Patas {manifest?.totals.stops ?? stops.length}
                {' | '}Entrega {manifestDeliveryLegs} | Recogida {manifestPickupLegs}
                {' | '}Completadas {manifest?.totals.completed ?? 0}
              </span>
            )}
            <ExportActionsModal
              title="Exportar manifest de ruta"
              triggerDisabled={!id || !canExport}
              actions={[
                {
                  id: 'manifest-csv',
                  label: 'CSV manifest',
                  run: () => exportManifestCsv(),
                },
                {
                  id: 'manifest-pdf',
                  label: 'PDF manifest',
                  run: () => exportManifestPdf(),
                },
              ]}
            />
          </div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Notas operativas</div>
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
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Servicios asignados</div>
            <div className="mobile-ops-list">
              {manifestGroupedByExpedition.map((group) => (
                <article key={`manifest-group-${group.expedition_reference}`} className="mobile-ops-card">
                  <div className="mobile-ops-card-header">
                    <div>
                      <strong>{group.expedition_reference}</strong>
                      <div className="helper">{routeOperationKindLabel(group.operation_kind)} · {group.product_category === 'thermo' ? 'Thermo' : group.product_category === 'parcel' ? 'Paquetería' : '-'}</div>
                    </div>
                    <Badge variant="outline">{group.pickup && group.delivery ? 'Circuito completo' : 'Pata única'}</Badge>
                  </div>
                  <div className="mobile-ops-card-grid">
                    <div><div className="kpi-label">Recogida</div><div>{group.pickup?.reference ?? '-'}</div></div>
                    <div><div className="kpi-label">Entrega</div><div>{group.delivery?.reference ?? '-'}</div></div>
                    <div><div className="kpi-label">Estado recogida</div><div>{group.pickup?.status ?? '-'}</div></div>
                    <div><div className="kpi-label">Estado entrega</div><div>{group.delivery?.status ?? '-'}</div></div>
                  </div>
                </article>
              ))}
            </div>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sec.</TableHead>
                    <TableHead>Servicio / pata</TableHead>
                    <TableHead>Expedición</TableHead>
                    <TableHead>Circuito</TableHead>
                    <TableHead>Operación</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Contraparte</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Ventana</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifestStops.map((stop) => (
                    <TableRow key={`manifest-${stop.id}`}>
                      <TableCell>{stop.sequence}</TableCell>
                      <TableCell>
                        <strong>{stop.reference ?? stop.entity_id}</strong>
                        <div className="helper">{routeStopTypeLabel(stop.stop_type)} · {routeServiceTypeLabel(stop.service_type)}</div>
                        <div className="helper">
                          {stop.stop_type === 'PICKUP' ? 'Pata de recogida' : 'Pata de entrega'}
                          {stop.linked_reference ? ` · Vinculado con ${stop.linked_reference}` : ''}
                        </div>
                      </TableCell>
                      <TableCell>{stop.expedition_reference ?? '-'}</TableCell>
                      <TableCell>
                        <div>{stop.stop_type === 'PICKUP' ? 'Recogida -> Entrega' : 'Entrega <- Recogida'}</div>
                        <div className="helper">{stop.linked_reference ?? '-'}</div>
                      </TableCell>
                      <TableCell>{routeOperationKindLabel(stop.operation_kind)}</TableCell>
                      <TableCell>{stop.product_category === 'thermo' ? 'Thermo' : stop.product_category === 'parcel' ? 'Paquetería' : '-'}</TableCell>
                      <TableCell>{stop.counterparty_name ?? '-'}</TableCell>
                      <TableCell>{stop.address_line ?? '-'}</TableCell>
                      <TableCell>
                        <div>{stop.planned_at ? new Date(stop.planned_at).toLocaleString('es-ES') : '-'}</div>
                        <div className="helper">{stop.completed_at ? `Comp. ${new Date(stop.completed_at).toLocaleString('es-ES')}` : 'Pendiente'}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{stop.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
            <div className="mobile-ops-list">
              {manifestStops.map((stop) => (
                <article key={`manifest-mobile-${stop.id}`} className="mobile-ops-card">
                  <div className="mobile-ops-card-header">
                    <div>
                      <strong>{stop.reference ?? stop.entity_id}</strong>
                      <div className="helper">{routeStopTypeLabel(stop.stop_type)} · {routeServiceTypeLabel(stop.service_type)}</div>
                      <div className="helper">
                        {stop.stop_type === 'PICKUP' ? 'Pata de recogida' : 'Pata de entrega'}
                        {stop.linked_reference ? ` · Vinculado con ${stop.linked_reference}` : ''}
                      </div>
                    </div>
                    <Badge variant="secondary">{stop.status}</Badge>
                  </div>
                  <div className="mobile-ops-card-grid">
                    <div><div className="kpi-label">Expedición</div><div>{stop.expedition_reference ?? '-'}</div></div>
                    <div><div className="kpi-label">Circuito</div><div>{stop.linked_reference ?? '-'}</div></div>
                    <div><div className="kpi-label">Operación</div><div>{routeOperationKindLabel(stop.operation_kind)}</div></div>
                    <div><div className="kpi-label">Producto</div><div>{stop.product_category === 'thermo' ? 'Thermo' : stop.product_category === 'parcel' ? 'Paquetería' : '-'}</div></div>
                    <div><div className="kpi-label">Contraparte</div><div>{stop.counterparty_name ?? '-'}</div></div>
                    <div><div className="kpi-label">Dirección</div><div>{stop.address_line ?? '-'}</div></div>
                    <div><div className="kpi-label">Ventana</div><div>{stop.planned_at ? new Date(stop.planned_at).toLocaleString('es-ES') : '-'}</div></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Carga principal por expedición</div>
          <div className="inline-actions">
            <label htmlFor="bulk-expedition-ids">Expediciones</label>
            <input
              id="bulk-expedition-search"
              value={expeditionQuery}
              onChange={(event) => setExpeditionQuery(event.target.value)}
              placeholder="Buscar expedición por referencia, contraparte o pata"
            />
            <select
              id="bulk-expedition-ids"
              multiple
              value={bulkExpeditionIds}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                setBulkExpeditionIds(values);
              }}
            >
              {filteredExpeditions.map((expedition) => (
                <option key={expedition.id} value={expedition.id}>
                  {expedition.reference} · {routeOperationKindLabel(expedition.operation_kind)} · {expedition.pickup_reference ?? 'Sin recogida'} {'->'} {expedition.shipment_reference ?? 'Sin entrega'}
                </option>
              ))}
            </select>
            <Button type="button" onClick={bulkAddStops} disabled={bulkAdding}>
              {bulkAdding ? 'Agregando...' : 'Agregar seleccionados'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAdvancedLegSelectors((value) => !value)}>
              {showAdvancedLegSelectors ? 'Ocultar ajustes por pata' : 'Ajustes avanzados'}
            </Button>
          </div>
          {showAdvancedLegSelectors ? (
            <div className="inline-actions">
              <label htmlFor="bulk-shipment-ids">Entregas sueltas</label>
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
              <label htmlFor="bulk-pickup-ids">Recogidas sueltas</label>
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
            </div>
          ) : null}
          <div className="helper">La carga principal añade automáticamente recogida y entrega de cada expedición. Los selectores por pata quedan reservados para incidencias operativas o correcciones puntuales.</div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Alta manual excepcional</div>
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
            <label htmlFor="stop-entity-id">{stopType === 'DELIVERY' ? 'Entrega' : 'Recogida'}</label>
            {stopType === 'DELIVERY' ? (
              <>
                <input
                  id="stop-entity-search"
                  value={shipmentQuery}
                  onChange={(event) => setShipmentQuery(event.target.value)}
                  placeholder="Buscar entrega por referencia o ID"
                />
                <select id="stop-entity-id" value={selectedShipmentId} onChange={(event) => setSelectedShipmentId(event.target.value)}>
                  <option value="">Selecciona entrega</option>
                  {filteredShipments.map((shipment) => (
                    <option key={shipment.id} value={shipment.id}>
                      {shipment.reference} · {shipment.consignee_name ?? 'Sin destinatario'} · {routeServiceTypeLabel(shipment.service_type)} · {shipment.status}
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
                      {pickup.reference} · {pickup.requester_name ?? 'Sin solicitante'} · {pickup.pickup_type === 'RETURN' ? 'Devolución' : 'Recogida'} · {pickup.expedition_reference ?? 'Sin expedición'}
                    </option>
                  ))}
                </select>
              </>
            )}
            <Button type="button" onClick={createStop} disabled={savingStop}>
              {savingStop ? 'Creando...' : 'Agregar parada manual'}
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
          <div className="helper">Este bloque queda para excepciones. La planificación normal debe entrar por expediciones completas.</div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Selección y limpieza</div>
          <div className="inline-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedStopIds(stops.map((stop) => stop.id))}
              disabled={stops.length === 0 || bulkDeletingStops}
            >
              Seleccionar todo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedStopIds([])}
              disabled={selectedStopIds.length === 0 || bulkDeletingStops}
            >
              Limpiar seleccion
            </Button>
            <span className="helper">Seleccionadas: {selectedStopIds.length}</span>
            <Button
              type="button"
              variant="outline"
              onClick={deleteSelectedStops}
              disabled={selectedStopIds.length === 0 || bulkDeletingStops || bulkUpdatingStops}
            >
              {bulkDeletingStops ? 'Eliminando...' : 'Eliminar seleccionadas'}
            </Button>
          </div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Plantillas y presets</div>
          <div className="filters-panel">
            <div className="inline-actions">
              <label htmlFor="bulk-template-select">Plantilla masiva</label>
              <select
                id="bulk-template-select"
                value={selectedBulkTemplateId}
                onChange={(event) => {
                  const idValue = event.target.value;
                  setSelectedBulkTemplateId(idValue);
                  const selected = bulkTemplates.find((item) => item.id === idValue);
                  setSelectedBulkTemplateName(selected?.name ?? '');
                }}
              >
                <option value="">Selecciona plantilla</option>
                {bulkTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <input
                value={selectedBulkTemplateName}
                onChange={(event) => setSelectedBulkTemplateName(event.target.value)}
                placeholder="Renombrar plantilla seleccionada"
                disabled={!selectedBulkTemplateId}
              />
              <Button type="button" variant="outline" onClick={renameBulkTemplate} disabled={!selectedBulkTemplateId || !selectedBulkTemplateName.trim()}>
                Renombrar
              </Button>
              <Button type="button" variant="outline" onClick={duplicateBulkTemplate} disabled={!selectedBulkTemplateId}>
                Duplicar
              </Button>
              <Button type="button" variant="outline" onClick={applyBulkTemplate} disabled={!selectedBulkTemplateId}>
                Aplicar plantilla
              </Button>
              <Button type="button" variant="outline" onClick={deleteBulkTemplate} disabled={!selectedBulkTemplateId}>
                Eliminar plantilla
              </Button>
              <input
                value={bulkTemplateName}
                onChange={(event) => setBulkTemplateName(event.target.value)}
                placeholder="Nombre nueva plantilla"
              />
              <Button type="button" variant="outline" onClick={saveBulkTemplate}>
                Guardar plantilla
              </Button>
            </div>
          </div>
          <div className="inline-actions">
            <span className="helper">Presets operativos</span>
            <Button type="button" variant="outline" onClick={() => applyBulkPreset('start_shift')} disabled={bulkUpdatingStops || bulkDeletingStops}>Inicio turno</Button>
            <Button type="button" variant="outline" onClick={() => applyBulkPreset('mark_in_progress_now')} disabled={bulkUpdatingStops || bulkDeletingStops}>En curso ahora</Button>
            <Button type="button" variant="outline" onClick={() => applyBulkPreset('complete_now')} disabled={bulkUpdatingStops || bulkDeletingStops}>Cerrar ahora</Button>
            <Button type="button" variant="outline" onClick={() => applyBulkPreset('delay_15')} disabled={bulkUpdatingStops || bulkDeletingStops}>Retrasar +15m</Button>
            <Button type="button" variant="outline" onClick={() => applyBulkPreset('delay_30')} disabled={bulkUpdatingStops || bulkDeletingStops}>Retrasar +30m</Button>
            <Button type="button" variant="outline" onClick={() => applyBulkPreset('clear')} disabled={bulkUpdatingStops || bulkDeletingStops}>Limpiar</Button>
          </div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Cambios masivos</div>
          <div className="inline-actions">
            <label htmlFor="bulk-stop-status">Estado masivo</label>
            <select
              id="bulk-stop-status"
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as '' | 'planned' | 'in_progress' | 'completed')}
              disabled={bulkUpdatingStops || bulkDeletingStops}
            >
              <option value="">Sin cambio</option>
              <option value="planned">planned</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
            </select>
            <label htmlFor="bulk-stop-planned-at">ETA planificada</label>
            <input
              id="bulk-stop-planned-at"
              type="datetime-local"
              value={bulkPlannedAt}
              onChange={(event) => setBulkPlannedAt(event.target.value)}
              disabled={bulkUpdatingStops || bulkDeletingStops}
            />
            <label htmlFor="bulk-stop-completed-at">ETA completada</label>
            <input
              id="bulk-stop-completed-at"
              type="datetime-local"
              value={bulkCompletedAt}
              onChange={(event) => setBulkCompletedAt(event.target.value)}
              disabled={bulkUpdatingStops || bulkDeletingStops}
            />
            <label htmlFor="bulk-stop-shift">Desplazar ETA (min)</label>
            <input
              id="bulk-stop-shift"
              type="number"
              step={5}
              value={bulkEtaShiftMinutes}
              onChange={(event) => setBulkEtaShiftMinutes(event.target.value)}
              disabled={bulkUpdatingStops || bulkDeletingStops}
            />
            <Button type="button" variant="outline" onClick={() => setBulkEtaShiftMinutes('-15')} disabled={bulkUpdatingStops || bulkDeletingStops}>-15m</Button>
            <Button type="button" variant="outline" onClick={() => setBulkEtaShiftMinutes('15')} disabled={bulkUpdatingStops || bulkDeletingStops}>+15m</Button>
            <Button type="button" variant="outline" onClick={() => setBulkEtaShiftMinutes('30')} disabled={bulkUpdatingStops || bulkDeletingStops}>+30m</Button>
            <label htmlFor="bulk-stop-reason-code">Motivo</label>
            <select
              id="bulk-stop-reason-code"
              value={bulkReasonCode}
              onChange={(event) => setBulkReasonCode(event.target.value as RouteBulkReasonCode)}
              disabled={bulkUpdatingStops || bulkDeletingStops}
            >
              {routeBulkReasonOptions.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
            <label htmlFor="bulk-stop-reason-detail">Detalle motivo</label>
            <input
              id="bulk-stop-reason-detail"
              value={bulkReasonDetail}
              onChange={(event) => setBulkReasonDetail(event.target.value)}
              placeholder="Detalle opcional (obligatorio si motivo=OTHER)"
              disabled={bulkUpdatingStops || bulkDeletingStops}
            />
            <Button
              type="button"
              variant="outline"
              onClick={openBulkUpdatePreview}
              disabled={selectedStopIds.length === 0 || bulkUpdatingStops || bulkDeletingStops}
            >
              Previsualizar cambios
            </Button>
          </div>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sel</TableHead>
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
                        type="checkbox"
                        checked={selectedStopIds.includes(stop.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedStopIds((current) => (
                            checked
                              ? Array.from(new Set([...current, stop.id]))
                              : current.filter((id) => id !== stop.id)
                          ));
                        }}
                        disabled={bulkDeletingStops}
                      />
                    </TableCell>
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
          <div className="mobile-ops-list">
            {stops.map((stop, index) => (
              <article key={`mobile-stop-${stop.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{stop.reference ?? stop.entity_id}</strong>
                    <div className="helper">Secuencia {stop.sequence} · {stop.entity_type}</div>
                  </div>
                  <Badge variant="secondary">{stop.status}</Badge>
                </div>
                <div className="inline-actions">
                  <label htmlFor={`mobile-stop-selected-${stop.id}`}>Seleccionar</label>
                  <input
                    id={`mobile-stop-selected-${stop.id}`}
                    type="checkbox"
                    checked={selectedStopIds.includes(stop.id)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedStopIds((current) => (
                        checked
                          ? Array.from(new Set([...current, stop.id]))
                          : current.filter((itemId) => itemId !== stop.id)
                      ));
                    }}
                    disabled={bulkDeletingStops}
                  />
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Tipo</div>
                    <div>{stop.stop_type}</div>
                  </div>
                  <div>
                    <div className="kpi-label">ETA</div>
                    <div>{toLocalDateTime(etaSuggestions[stop.id]) || '-'}</div>
                  </div>
                </div>
                <div className="modal-section">
                  <div className="modal-section-title">Edición rápida</div>
                  <div className="inline-actions">
                    <label htmlFor={`mobile-stop-status-${stop.id}`}>Estado</label>
                    <select
                      id={`mobile-stop-status-${stop.id}`}
                      disabled={reorderingStops}
                      value={stop.status}
                      onChange={(event) => updateStop(stop.id, { status: event.target.value as 'planned' | 'in_progress' | 'completed' })}
                    >
                      <option value="planned">planned</option>
                      <option value="in_progress">in_progress</option>
                      <option value="completed">completed</option>
                    </select>
                    <label htmlFor={`mobile-stop-planned-${stop.id}`}>ETA planificada</label>
                    <input
                      id={`mobile-stop-planned-${stop.id}`}
                      type="datetime-local"
                      value={toLocalDateTime(stop.planned_at)}
                      onChange={(event) => {
                        const iso = toIsoDateTime(event.target.value);
                        updateStop(stop.id, { planned_at: iso });
                      }}
                    />
                  </div>
                </div>
                <div className="mobile-ops-card-actions">
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
                  <Button type="button" variant="outline" disabled={reorderingStops} onClick={() => deleteStop(stop.id)}>
                    Eliminar
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <div className="helper">
            Arrastra y suelta una fila para reordenar paradas. {reorderingStops ? 'Guardando orden...' : ''}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => setShowAudit((value) => !value)}>
            {showAudit ? 'Ocultar auditoría' : 'Mostrar auditoría'}
          </Button>
        </CardContent>
      </Card>
      {showAudit ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Auditoría Operativa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="inline-actions">
                <ExportActionsModal
                  title="Exportar auditoría operativa"
                  triggerDisabled={!canExport || opsAudit.length === 0}
                  actions={[
                    {
                      id: 'audit-csv',
                      label: 'CSV auditoría',
                      run: () => {
                        exportOpsAuditCsv();
                      },
                    },
                  ]}
                />
              </div>
              {opsAudit.length === 0 ? (
                <div className="helper">Sin eventos aún.</div>
              ) : (
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opsAudit.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{toLocalDateTime(entry.at)}</TableCell>
                          <TableCell>{entry.action}</TableCell>
                          <TableCell>{entry.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              )}
            </CardContent>
          </Card>
          <EntityActivityTimeline
            title="Actividad de ruta (auditoría persistida)"
            resource="route"
            entityId={id}
            eventPrefix="route."
          />
        </>
      ) : null}
    </section>
  );
}
