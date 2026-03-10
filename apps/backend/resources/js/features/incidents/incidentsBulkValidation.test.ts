import { describe, expect, it } from 'vitest';
import { composeIncidentBulkResolveNotes, validateIncidentBulkResolve } from './incidentsBulkValidation';

describe('incidents bulk validation', () => {
  it('validates selected scope and mandatory inputs', () => {
    expect(validateIncidentBulkResolve({
      scope: 'selected',
      selectedCount: 0,
      reasonCode: 'DATA_CORRECTION',
      reasonDetail: '',
      notes: 'nota válida en texto',
    })).toContain('Selecciona al menos una incidencia');

    expect(validateIncidentBulkResolve({
      scope: 'filtered',
      selectedCount: 0,
      reasonCode: 'DATA_CORRECTION',
      reasonDetail: '',
      notes: 'corta',
    })).toContain('mínimo 8 caracteres');
  });

  it('requires reason detail for OTHER and composes notes', () => {
    expect(validateIncidentBulkResolve({
      scope: 'selected',
      selectedCount: 2,
      reasonCode: 'OTHER',
      reasonDetail: '',
      notes: 'nota suficientemente larga',
    })).toContain('OTHER');

    const composed = composeIncidentBulkResolveNotes({
      reasonCode: 'OTHER',
      reasonLabel: 'Otro motivo',
      reasonDetail: 'Detalle manual',
      notes: 'Cierre por ajuste operativo',
    });

    expect(composed).toContain('[OTHER] Otro motivo');
    expect(composed).toContain('Detalle manual');
    expect(composed).toContain('Cierre por ajuste operativo');
  });
});
