import { describe, expect, it } from 'vitest';
import { validatePartnerBulkStatusAction } from './bulkStatusValidation';

describe('partners bulk status validation', () => {
  it('requires selection and meaningful note', () => {
    expect(validatePartnerBulkStatusAction({
      selectedCount: 0,
      entityLabel: 'subcontrata',
      reasonCode: 'REBALANCE',
      reasonDetail: '',
      reasonNote: 'nota válida de prueba',
    })).toBe('Selecciona al menos una subcontrata.');

    expect(validatePartnerBulkStatusAction({
      selectedCount: 3,
      entityLabel: 'conductor',
      reasonCode: 'COMPLIANCE',
      reasonDetail: '',
      reasonNote: 'corta',
    })).toContain('mínimo 8 caracteres');
  });

  it('requires detail when reason code is OTHER', () => {
    expect(validatePartnerBulkStatusAction({
      selectedCount: 2,
      entityLabel: 'vehículo',
      reasonCode: 'OTHER',
      reasonDetail: '',
      reasonNote: 'motivo suficientemente largo',
    })).toContain('OTHER');

    expect(validatePartnerBulkStatusAction({
      selectedCount: 2,
      entityLabel: 'vehículo',
      reasonCode: 'OTHER',
      reasonDetail: 'Reasignación puntual',
      reasonNote: 'motivo suficientemente largo',
    })).toBeNull();
  });
});
