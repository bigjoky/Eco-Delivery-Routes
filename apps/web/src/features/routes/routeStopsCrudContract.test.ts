import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';

describe('route stops CRUD contract', () => {
  test('create, update and delete stop should keep normalized stop shape', async () => {
    const created = await apiClient.createRouteStop('r-1', {
      sequence: 9,
      stop_type: 'DELIVERY',
      shipment_id: '00000000-0000-0000-0000-000000009999',
      status: 'planned',
    });

    expect(created.route_id).toBe('r-1');
    expect(created.entity_type).toBe('shipment');
    expect(created.entity_id).toBe('00000000-0000-0000-0000-000000009999');

    const updated = await apiClient.updateRouteStop('r-1', created.id, {
      status: 'in_progress',
      sequence: 10,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.status).toBe('in_progress');
    expect(updated.sequence).toBe(10);

    const remaining = await apiClient.deleteRouteStop('r-1', created.id);
    expect(remaining.find((row) => row.id === created.id)).toBeUndefined();
    if (remaining.length > 0) {
      expect(remaining[0].sequence).toBe(1);
    }
  });
});
