import { describe, expect, it } from 'vitest';
import { getAuditRangeDates } from './DashboardPage';

describe('dashboard audit range helpers', () => {
  it('returns valid date windows for supported presets', () => {
    const day = getAuditRangeDates('24h');
    const week = getAuditRangeDates('7d');
    const month = getAuditRangeDates('30d');

    expect(day.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(day.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(week.dateFrom <= week.dateTo).toBe(true);
    expect(month.dateFrom <= month.dateTo).toBe(true);
  });
});
