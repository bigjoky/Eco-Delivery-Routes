export type IncidentBulkReasonCode =
  | 'DELIVERY_CONFIRMED_EXTERNALLY'
  | 'CUSTOMER_RESCHEDULED'
  | 'DUPLICATE_INCIDENT'
  | 'DATA_CORRECTION'
  | 'OTHER';

export function validateIncidentBulkResolve(input: {
  scope: 'selected' | 'filtered';
  selectedCount: number;
  reasonCode: IncidentBulkReasonCode;
  reasonDetail: string;
  notes: string;
}): string | null {
  if (input.scope === 'selected' && input.selectedCount <= 0) {
    return 'Selecciona al menos una incidencia abierta.';
  }

  if (input.notes.trim().length < 8) {
    return 'Define una nota de resolución (mínimo 8 caracteres) para el cierre masivo.';
  }

  if (!input.reasonCode) {
    return 'Selecciona un motivo estructurado de resolución.';
  }

  if (input.reasonCode === 'OTHER' && input.reasonDetail.trim().length === 0) {
    return 'Cuando el motivo es OTHER, indica también un detalle.';
  }

  return null;
}

export function composeIncidentBulkResolveNotes(input: {
  reasonCode: IncidentBulkReasonCode;
  reasonLabel: string;
  reasonDetail: string;
  notes: string;
}): string {
  return `[${input.reasonCode}] ${input.reasonLabel}`
    + (input.reasonDetail.trim() ? ` | Detalle: ${input.reasonDetail.trim()}` : '')
    + ` | Nota: ${input.notes.trim()}`;
}
