import { describe, expect, it } from 'vitest';
import { buildDashboardRangeQuery } from './DashboardPage';

describe('dashboard links helpers', () => {
  it('builds routes/incidents range query using date_from/date_to', () => {
    expect(buildDashboardRangeQuery('2026-03-01', '2026-03-08', 'routes')).toBe('date_from=2026-03-01&date_to=2026-03-08');
    expect(buildDashboardRangeQuery('2026-03-01', '2026-03-08', 'incidents')).toBe('date_from=2026-03-01&date_to=2026-03-08');
  });

  it('builds shipments range query using scheduled_from/scheduled_to', () => {
    expect(buildDashboardRangeQuery('2026-03-01', '2026-03-08', 'shipments')).toBe('scheduled_from=2026-03-01&scheduled_to=2026-03-08');
  });

  it('returns empty query when range is incomplete', () => {
    expect(buildDashboardRangeQuery('', '2026-03-08', 'routes')).toBe('');
    expect(buildDashboardRangeQuery('2026-03-01', '', 'shipments')).toBe('');
  });
});
