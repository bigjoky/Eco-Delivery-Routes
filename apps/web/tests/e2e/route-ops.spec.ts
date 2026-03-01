import { test, expect } from '@playwright/test';

test('route ops flow: open route, update manifest notes, undo stop', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('eco_delivery_routes_token', 'mock-token');
    window.localStorage.setItem('eco_delivery_routes_roles', JSON.stringify(['super_admin']));
  });
  await page.goto('/routes');
  await page.waitForURL('**/routes');

  const firstRoute = page.locator('table a').first();
  await expect(firstRoute).toBeVisible();
  await firstRoute.click();
  await page.waitForURL('**/routes/**');

  await expect(page.getByText('Paradas de Ruta')).toBeVisible();
  await expect(page.getByText('Manifest:')).toBeVisible();

  await page.fill('textarea#manifest-notes', 'Notas E2E');
  await page.click('text=Guardar notas');
  await expect(page.getByText('Guardar notas')).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  const deleteButtons = page.getByText('Eliminar');
  if ((await deleteButtons.count()) === 0) {
    await page.selectOption('#stop-type', 'DELIVERY');
    await page.selectOption('#stop-entity-id', { index: 1 });
    await page.click('text=Agregar parada');
  }
  await deleteButtons.first().click();
  await expect(page.getByText('Deshacer eliminacion')).toBeVisible({ timeout: 5000 });
  await page.click('text=Deshacer eliminacion');

  await expect(page.getByText('Export CSV')).toBeVisible();
  await expect(page.getByText('Export PDF')).toBeVisible();
});
