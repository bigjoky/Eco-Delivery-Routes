import { describe, expect, it } from 'vitest';
import { mockApi } from '../../mocks/mockApi';

describe('driver route contract', () => {
  it('returns normalized entity fields for each stop', async () => {
    const payload = await mockApi.getMyDriverRoute();
    expect(payload.stops.length).toBeGreaterThan(0);

    payload.stops.forEach((stop) => {
      expect(['shipment', 'pickup']).toContain(stop.entity_type);
      expect(stop.entity_id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(stop.reference).toBeTruthy();
    });
  });
});
