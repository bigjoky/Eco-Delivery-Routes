export type PartnerBulkReasonCode = 'REBALANCE' | 'COMPLIANCE' | 'PERFORMANCE' | 'OTHER';

export function validatePartnerBulkStatusAction(input: {
  selectedCount: number;
  entityLabel: 'subcontrata' | 'conductor' | 'vehículo';
  reasonCode: PartnerBulkReasonCode;
  reasonDetail: string;
  reasonNote: string;
}): string | null {
  if (input.selectedCount <= 0) {
    const targetLabel = input.entityLabel === 'subcontrata' ? 'una subcontrata' : `un ${input.entityLabel}`;
    return `Selecciona al menos ${targetLabel}.`;
  }

  if (input.reasonNote.trim().length < 8) {
    return 'Define una nota de motivo (mínimo 8 caracteres) para la acción masiva.';
  }

  if (input.reasonCode === 'OTHER' && input.reasonDetail.trim().length === 0) {
    return 'Cuando el motivo es OTHER, indica también un detalle.';
  }

  return null;
}
