import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';

describe('shipments bulk preview contract', () => {
  test('returns target_count and sample for filtered bulk preview', async () => {
    const preview = await apiClient.previewBulkUpdateShipments({
      apply_to_filtered: true,
      filter_q: 'SHP',
      status: 'incident',
      shipment_ids: [],
    });

    expect(preview.target_count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(preview.sample)).toBe(true);
    expect(preview.updates.status).toBe('incident');
  });
});
