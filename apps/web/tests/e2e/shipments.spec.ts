import { test, expect } from '@playwright/test';

test('shipments flow: list, export buttons, open detail', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[placeholder="Email"]', 'admin@eco.local');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('text=Entrar');
  await expect(page.getByRole('heading', { name: 'Envios', exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('Export CSV')).toBeVisible();
  await expect(page.getByText('Export PDF')).toBeVisible();
  await expect(page.getByText('Reset columnas')).toBeVisible();

  await page.selectOption('#shipment-status', 'delivered');
  await page.selectOption('#shipments-per-page', '25');
  await expect(page.getByText('Pagina 1 /')).toBeVisible();

  await page.click('text=Limpiar filtros');
  await expect(page.getByText('Pagina 1 /')).toBeVisible();

  const firstShipment = page.locator('table a').first();
  await expect(firstShipment).toBeVisible();
  await firstShipment.click();
  await page.waitForURL('**/shipments/**');

  await expect(page.getByText('Detalle envio')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'POD' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Incidencias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paradas' })).toBeVisible();
});

test('shipments flow: bulk update with reason and filtered scope', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[placeholder="Email"]', 'admin@eco.local');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('text=Entrar');
  await expect(page.getByRole('heading', { name: 'Envios', exact: true })).toBeVisible({ timeout: 60000 });

  await page.selectOption('#shipment-status', 'created');
  await page.fill('#shipment-query', 'SHP');
  await page.check('#bulk-filtered');
  await page.selectOption('#bulk-status', 'incident');
  await page.fill('#bulk-reason', 'Prueba e2e masivo');
  await page.click('text=Aplicar masivo');

  await expect(page.getByText(/Actualizados \d+ envios\./)).toBeVisible();
});
