import { describe, expect, it } from 'vitest';
import { buildAddressSuggestions } from './addressAutocomplete';

describe('address autocomplete', () => {
  it('prioritizes exact street/postal matches', () => {
    const rows = [
      {
        id: '1',
        display_name: 'A',
        address_street: 'Calle Larios',
        address_number: '12',
        postal_code: '29001',
        city: 'Malaga',
        country: 'ES',
      },
      {
        id: '2',
        display_name: 'B',
        address_street: 'Avenida Andalucia',
        address_number: '1',
        postal_code: '29002',
        city: 'Malaga',
        country: 'ES',
      },
    ];

    const suggestions = buildAddressSuggestions(rows, { street: 'Calle Larios', postalCode: '29001', city: 'Malaga' });
    expect(suggestions[0]?.address_street).toBe('Calle Larios');
    expect(suggestions[0]?.postal_code).toBe('29001');
  });

  it('normalizes postal code for portugal', () => {
    const rows = [
      {
        id: '1',
        display_name: 'PT',
        address_street: 'Rua Central',
        postal_code: '1000001',
        city: 'Lisboa',
        country: 'PT',
      },
    ];

    const suggestions = buildAddressSuggestions(rows, { city: 'Lisboa' });
    expect(suggestions[0]?.postal_code).toBe('1000-001');
  });
});
