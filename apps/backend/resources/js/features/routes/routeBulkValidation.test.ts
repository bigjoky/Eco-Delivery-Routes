import { describe, expect, it } from 'vitest';
import { validateRouteBulkUpdate } from './routeBulkValidation';

describe('route bulk update validation', () => {
  it('requires selection and at least one change', () => {
    expect(validateRouteBulkUpdate({
      selectedCount: 0,
      hasAnyChange: true,
      reasonCode: 'WEB_BULK_UPDATE',
      reasonDetail: '',
    })).toContain('Selecciona al menos una parada');

    expect(validateRouteBulkUpdate({
      selectedCount: 3,
      hasAnyChange: false,
      reasonCode: 'WEB_BULK_UPDATE',
      reasonDetail: '',
    })).toContain('Define al menos un campo');
  });

  it('requires reason detail for OTHER', () => {
    expect(validateRouteBulkUpdate({
      selectedCount: 3,
      hasAnyChange: true,
      reasonCode: 'OTHER',
      reasonDetail: '',
    })).toContain('OTHER');

    expect(validateRouteBulkUpdate({
      selectedCount: 3,
      hasAnyChange: true,
      reasonCode: 'OTHER',
      reasonDetail: 'Corte puntual por congestión',
    })).toBeNull();
  });
});
