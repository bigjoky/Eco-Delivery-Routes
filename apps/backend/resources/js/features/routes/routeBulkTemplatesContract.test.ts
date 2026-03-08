import { describe, expect, test } from 'vitest';
import { apiClient } from '../../services/apiClient';

describe('route bulk templates contract', () => {
  test('create rename duplicate apply and delete template lifecycle', async () => {
    const routes = await apiClient.getRoutes({ perPage: 1 });
    expect(routes.data.length).toBeGreaterThan(0);
    const routeId = routes.data[0].id;

    const created = await apiClient.createRouteBulkTemplate({
      route_id: routeId,
      name: `TPL-${Date.now()}`,
      status: 'planned',
      shift_minutes: 15,
    });
    expect(created.id).toBeTruthy();

    await apiClient.updateRouteBulkTemplate(created.id, { name: 'TPL-RENAMED' });
    const duplicated = await apiClient.duplicateRouteBulkTemplate(created.id);
    expect(duplicated.id).toBeTruthy();

    const templates = await apiClient.getRouteBulkTemplates(routeId);
    expect(templates.some((row) => row.id === created.id && row.name === 'TPL-RENAMED')).toBe(true);
    expect(templates.some((row) => row.id === duplicated.id)).toBe(true);

    await apiClient.deleteRouteBulkTemplate(created.id);
    await apiClient.deleteRouteBulkTemplate(duplicated.id);

    const afterDelete = await apiClient.getRouteBulkTemplates(routeId);
    expect(afterDelete.some((row) => row.id === created.id || row.id === duplicated.id)).toBe(false);
  });
});
