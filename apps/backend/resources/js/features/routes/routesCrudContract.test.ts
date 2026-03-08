import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';
import { mockApi } from '../../mocks/mockApi';

describe('routes CRUD contract', () => {
  test('create and update route assignment returns normalized route summary', async () => {
    const hubs = await mockApi.getHubs({ onlyActive: true });
    expect(hubs.length).toBeGreaterThan(0);

    const route = await apiClient.createRoute({
      hub_id: hubs[0].id,
      code: `R-TEST-${Date.now()}`,
      route_date: '2026-03-01',
    });

    expect(route.id).toBeTruthy();
    expect(route.status).toBe('planned');

    const updated = await apiClient.updateRoute(route.id, {
      status: 'in_progress',
    });

    expect(updated.id).toBe(route.id);
    expect(updated.status).toBe('in_progress');
  });
});
