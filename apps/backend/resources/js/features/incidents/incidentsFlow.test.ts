import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';

describe('incidents flow', () => {
  test('creates and resolves incidents with filter support', async () => {
    const created = await apiClient.createIncident({
      incidentable_type: 'shipment',
      incidentable_id: '00000000-0000-0000-0000-000000000101',
      catalog_code: 'ABSENT_HOME',
      category: 'absent',
      notes: 'created from test',
    });
    expect(created.id).toBeTruthy();
    expect(created.resolved_at).toBeNull();

    const openList = await apiClient.getIncidents({ resolved: 'open' });
    expect(openList.data.some((item) => item.id === created.id)).toBe(true);

    const resolved = await apiClient.resolveIncident(created.id, 'resolved from test');
    expect(resolved.resolved_at).toBeTruthy();

    const resolvedList = await apiClient.getIncidents({ resolved: 'resolved' });
    expect(resolvedList.data.some((item) => item.id === created.id)).toBe(true);
  });

  test('supports structured bulk SLA override payload', async () => {
    const created = await apiClient.createIncident({
      incidentable_type: 'shipment',
      incidentable_id: '00000000-0000-0000-0000-000000000102',
      catalog_code: 'ABSENT_HOME',
      category: 'absent',
      notes: 'bulk override target',
    });

    const result = await apiClient.overrideIncidentSlaBulk({
      incidentIds: [created.id],
      priority: 'high',
      reason: 'bulk override test',
    });
    expect(result.requested_count).toBeGreaterThanOrEqual(1);
  });
});
