import { describe, expect, it } from 'vitest';
import {
  hasRequiredRecipientName,
  hasRequiredSenderName,
  inferDocumentType,
  isValidPostalCode,
} from './shipmentFormValidation';

describe('shipment form validation', () => {
  it('infers DNI/NIE/CIF document types', () => {
    expect(inferDocumentType('12345678Z', 'PASSPORT')).toBe('DNI');
    expect(inferDocumentType('X1234567L', 'PASSPORT')).toBe('NIE');
    expect(inferDocumentType('B12345678', 'PASSPORT')).toBe('CIF');
    expect(inferDocumentType('ABCD', 'PASSPORT')).toBe('PASSPORT');
  });

  it('validates required sender/recipient names by document type', () => {
    expect(hasRequiredRecipientName('CIF', 'ACME SL', '', '')).toBe(true);
    expect(hasRequiredRecipientName('DNI', '', 'Ana', 'Perez')).toBe(true);
    expect(hasRequiredRecipientName('DNI', '', 'Ana', '')).toBe(false);

    expect(hasRequiredSenderName('CIF', 'Eco Logistics SL', '', '')).toBe(true);
    expect(hasRequiredSenderName('NIE', '', 'Luis', 'Martin')).toBe(true);
    expect(hasRequiredSenderName('NIE', '', '', 'Martin')).toBe(false);
  });

  it('validates postal code by country', () => {
    expect(isValidPostalCode('ES', '29001')).toBe(true);
    expect(isValidPostalCode('ES', '2900')).toBe(false);
    expect(isValidPostalCode('PT', '1000-001')).toBe(true);
    expect(isValidPostalCode('PT', '1000001')).toBe(true);
    expect(isValidPostalCode('DE', '10115')).toBe(true);
    expect(isValidPostalCode('DE', '1011')).toBe(false);
    expect(isValidPostalCode('US', '10001')).toBe(true);
  });
});
