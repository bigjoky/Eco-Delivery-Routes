export const shipmentBulkReasonOptions = [
  { code: 'REPLAN_OPERATION', label: 'Replanificación operativa' },
  { code: 'CAPACITY_REBALANCE', label: 'Rebalanceo de capacidad' },
  { code: 'INCIDENT_CONTAINMENT', label: 'Contención de incidencias' },
  { code: 'ROUTE_OPTIMIZATION', label: 'Optimización de rutas' },
  { code: 'OTHER', label: 'Otro motivo' },
] as const;

export type ShipmentBulkReasonCode = (typeof shipmentBulkReasonOptions)[number]['code'];

export function validateShipmentBulkUpdate(input: {
  applyToFiltered: boolean;
  selectedCount: number;
  hasAnyChange: boolean;
  reasonCode: ShipmentBulkReasonCode;
  reasonDetail: string;
  reasonNote: string;
}): string | null {
  if (!input.applyToFiltered && input.selectedCount <= 0) {
    return 'Selecciona al menos un envío o marca aplicar a filtrados.';
  }

  if (!input.hasAnyChange) {
    return 'Selecciona al menos un cambio masivo (estado, hub o fecha).';
  }

  if (input.reasonNote.trim().length < 8) {
    return 'Indica un motivo para auditoría (mínimo 8 caracteres).';
  }

  if (input.reasonCode === 'OTHER' && input.reasonDetail.trim().length === 0) {
    return 'Cuando el motivo es OTHER, indica también un detalle.';
  }

  return null;
}
