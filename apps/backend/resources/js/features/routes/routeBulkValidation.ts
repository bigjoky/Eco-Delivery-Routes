export const routeBulkReasonOptions = [
  { code: 'WEB_BULK_UPDATE', label: 'Actualización masiva web' },
  { code: 'REBALANCE_ROUTE', label: 'Rebalanceo de ruta' },
  { code: 'TRAFFIC_DELAY', label: 'Retraso de tráfico' },
  { code: 'CUSTOMER_WINDOW_CHANGE', label: 'Cambio de franja cliente' },
  { code: 'OTHER', label: 'Otro motivo' },
] as const;

export type RouteBulkReasonCode = (typeof routeBulkReasonOptions)[number]['code'];

export function validateRouteBulkUpdate(input: {
  selectedCount: number;
  hasAnyChange: boolean;
  reasonCode: RouteBulkReasonCode;
  reasonDetail: string;
}): string | null {
  if (input.selectedCount <= 0) {
    return 'Selecciona al menos una parada para actualizar.';
  }

  if (!input.hasAnyChange) {
    return 'Define al menos un campo masivo (estado, ETA o desplazamiento).';
  }

  if (!input.reasonCode) {
    return 'Selecciona un motivo estructurado para la actualización masiva.';
  }

  if (input.reasonCode === 'OTHER' && input.reasonDetail.trim().length === 0) {
    return 'Cuando el motivo es OTHER, indica también un detalle.';
  }

  return null;
}
