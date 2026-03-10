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

    const reordered = await apiClient.reorderRouteStops('r-1', [updated.id, 'st-1', 'st-2']);
    expect(reordered[0].id).toBe(updated.id);
    expect(reordered[0].sequence).toBe(1);

    const bulk = await apiClient.bulkAddRouteStops('r-1', {
      shipment_ids: ['00000000-0000-0000-0000-000000001111'],
      pickup_ids: ['00000000-0000-0000-0000-000000002222'],
      status: 'planned',
    });
    expect(bulk.created_count).toBeGreaterThanOrEqual(1);
    const bulkUpdated = await apiClient.bulkUpdateRouteStops('r-1', {
      stop_ids: [updated.id],
      status: 'completed',
      reason_code: 'WEB_BULK_UPDATE',
    });
    expect(bulkUpdated.updated_count).toBe(1);
    expect(bulkUpdated.stops.find((row) => row.id === updated.id)?.status).toBe('completed');

    const manifest = await apiClient.getRouteManifest('r-1');
    expect(manifest.route.id).toBe('r-1');
    expect(manifest.totals.stops).toBeGreaterThan(0);
    const updatedNotes = await apiClient.updateRouteManifest('r-1', { manifest_notes: 'Notas de prueba' });
    expect(updatedNotes.route_id).toBe('r-1');
    expect(updatedNotes.manifest_notes).toBe('Notas de prueba');

    const remaining = await apiClient.deleteRouteStop('r-1', created.id);
    expect(remaining.find((row) => row.id === created.id)).toBeUndefined();
    if (remaining.length > 0) {
      expect(remaining[0].sequence).toBe(1);
    }

    const restored = await apiClient.createRouteStop('r-1', {
      sequence: 1,
      stop_type: 'DELIVERY',
      shipment_id: '00000000-0000-0000-0000-000000009999',
      status: 'planned',
      undo_of_stop_id: created.id,
    });
    expect(restored.route_id).toBe('r-1');
    expect(restored.entity_type).toBe('shipment');

    await expect(apiClient.exportRouteManifestCsv('r-1')).resolves.toBeUndefined();
    await expect(apiClient.exportRouteManifestPdf('r-1')).resolves.toBeUndefined();
  });
});
