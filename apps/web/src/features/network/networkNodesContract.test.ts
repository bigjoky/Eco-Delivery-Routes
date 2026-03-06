import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';

describe('network nodes contract', () => {
  test('creates, updates, archives and restores hub/depot/point', async () => {
    const hub = await apiClient.createHub({
      name: `Hub Contract ${Date.now()}`,
      city: 'Malaga',
    });
    expect(hub.id).toBeTruthy();
    expect(hub.deleted_at ?? null).toBeNull();

    const updatedHub = await apiClient.updateHub(hub.id, {
      name: `${hub.name} Updated`,
      city: 'Sevilla',
    });
    expect(updatedHub.name).toContain('Updated');

    const depot = await apiClient.createDepot({
      hub_id: hub.id,
      name: `Depot Contract ${Date.now()}`,
      city: 'Malaga',
    });
    expect(depot.id).toBeTruthy();

    const updatedDepot = await apiClient.updateDepot(depot.id, {
      name: `${depot.name} Updated`,
      city: 'Cordoba',
    });
    expect(updatedDepot.name).toContain('Updated');

    const point = await apiClient.createPoint({
      hub_id: hub.id,
      depot_id: depot.id,
      name: `Point Contract ${Date.now()}`,
      city: 'Malaga',
    });
    expect(point.id).toBeTruthy();

    const updatedPoint = await apiClient.updatePoint(point.id, {
      name: `${point.name} Updated`,
      city: 'Granada',
    });
    expect(updatedPoint.name).toContain('Updated');

    const archivePoint = await apiClient.deletePoint(point.id);
    expect(archivePoint.deleted).toBe(true);
    await apiClient.restorePoint(point.id);
    await apiClient.deletePoint(point.id);

    const archiveDepot = await apiClient.deleteDepot(depot.id);
    expect(archiveDepot.deleted).toBe(true);
    await apiClient.restoreDepot(depot.id);
    await apiClient.deleteDepot(depot.id);

    const archiveHub = await apiClient.deleteHub(hub.id);
    expect(archiveHub.deleted).toBe(true);
    await apiClient.restoreHub(hub.id);

    const hubsWithArchived = await apiClient.getHubs({ onlyActive: false, includeDeleted: true });
    expect(hubsWithArchived.some((item) => item.id === hub.id)).toBe(true);
  });
});
