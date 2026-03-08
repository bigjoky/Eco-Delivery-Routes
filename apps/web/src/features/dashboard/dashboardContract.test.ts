import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';

describe('dashboard overview contract', () => {
  test('returns aggregated totals, alerts and productivity datasets', async () => {
    const overview = await apiClient.getDashboardOverview({ period: '7d' });

    expect(overview.totals.shipments).toBeTypeOf('number');
    expect(overview.totals.routes).toBeTypeOf('number');
    expect(Array.isArray(overview.alerts)).toBe(true);
    expect(Array.isArray(overview.productivity_by_hub)).toBe(true);
    expect(Array.isArray(overview.productivity_by_route)).toBe(true);
  });

  test('supports period filter', async () => {
    const today = await apiClient.getDashboardOverview({ period: 'today' });
    expect(today.period.preset === 'today' || today.period.preset === 'custom').toBe(true);
  });
});
