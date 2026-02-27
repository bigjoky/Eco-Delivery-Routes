import { describe, expect, it } from 'vitest';
import { mockApi } from './mockApi';

describe('mockApi', () => {
  it('returns a mock token on login', async () => {
    const result = await mockApi.login({ email: 'a@b.com', password: '12345678' });
    expect(result.token).toBe('mock-token');
  });

  it('returns a non-empty users list', async () => {
    const users = await mockApi.getUsers();
    expect(users.length).toBeGreaterThan(0);
  });

  it('filters quality snapshots by combined scope/hub/subcontractor/date', async () => {
    const rows = await mockApi.getQualitySnapshots({
      scopeType: 'route',
      hubId: '00000000-0000-0000-0000-000000000001',
      subcontractorId: 'sc-1',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
    });
    expect(rows.length).toBe(1);
    expect(rows[0].scope_type).toBe('route');
    expect(rows[0].scope_id).toBe('r-1');
  });
});
