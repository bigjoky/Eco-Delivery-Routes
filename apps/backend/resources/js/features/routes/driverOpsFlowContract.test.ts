import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';
import { mockApi } from '../../mocks/mockApi';

describe('driver ops flow contract', () => {
  test('stop contract provides normalized entity fields', async () => {
    const payload = await mockApi.getMyDriverRoute();
    const stop = payload.stops[0];
    expect(stop.entity_type).toMatch(/shipment|pickup/);
    expect(stop.entity_id).toBeTruthy();
    expect(stop.reference).toBeTruthy();
  });

  test('scan, pod and incident use entity contract end-to-end', async () => {
    const payload = await mockApi.getMyDriverRoute();
    const stop = payload.stops[0];
    expect(stop).toBeTruthy();

    const trackingEvent = await apiClient.registerScan({
      trackable_type: stop.entity_type,
      trackable_id: stop.entity_id,
      scan_code: 'SCAN-001',
    });
    expect(trackingEvent.trackable_id).toBe(stop.entity_id);

    const pod = await apiClient.registerPod({
      evidenceable_type: stop.entity_type,
      evidenceable_id: stop.entity_id,
      signature_name: 'Driver Demo',
    });
    expect(pod.evidenceable_id).toBe(stop.entity_id);

    const incident = await apiClient.createIncident({
      incidentable_type: stop.entity_type,
      incidentable_id: stop.entity_id,
      catalog_code: 'ABSENT_HOME',
      category: 'absent',
      notes: 'Cliente ausente',
    });
    expect(incident.incidentable_id).toBe(stop.entity_id);
  });
});
