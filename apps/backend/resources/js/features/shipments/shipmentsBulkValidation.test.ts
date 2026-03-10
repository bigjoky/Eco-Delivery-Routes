import { describe, expect, it } from 'vitest';
import { validateShipmentBulkUpdate } from './shipmentsBulkValidation';

describe('shipments bulk validation', () => {
  it('requires selected ids unless apply_to_filtered and at least one change', () => {
    expect(validateShipmentBulkUpdate({
      applyToFiltered: false,
      selectedCount: 0,
      hasAnyChange: true,
      reasonCode: 'REPLAN_OPERATION',
      reasonDetail: '',
      reasonNote: 'nota suficientemente larga',
    })).toContain('Selecciona al menos un envío');

    expect(validateShipmentBulkUpdate({
      applyToFiltered: true,
      selectedCount: 0,
      hasAnyChange: false,
      reasonCode: 'REPLAN_OPERATION',
      reasonDetail: '',
      reasonNote: 'nota suficientemente larga',
    })).toContain('Selecciona al menos un cambio');
  });

  it('requires meaningful reason note and detail for OTHER', () => {
    expect(validateShipmentBulkUpdate({
      applyToFiltered: true,
      selectedCount: 0,
      hasAnyChange: true,
      reasonCode: 'OTHER',
      reasonDetail: '',
      reasonNote: 'corta',
    })).toContain('mínimo 8 caracteres');

    expect(validateShipmentBulkUpdate({
      applyToFiltered: true,
      selectedCount: 0,
      hasAnyChange: true,
      reasonCode: 'OTHER',
      reasonDetail: '',
      reasonNote: 'nota suficientemente larga',
    })).toContain('OTHER');

    expect(validateShipmentBulkUpdate({
      applyToFiltered: true,
      selectedCount: 0,
      hasAnyChange: true,
      reasonCode: 'OTHER',
      reasonDetail: 'Ajuste excepcional',
      reasonNote: 'nota suficientemente larga',
    })).toBeNull();
  });
});
