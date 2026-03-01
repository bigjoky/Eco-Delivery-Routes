import { test, expect } from '@playwright/test';

test('shipments flow: list, export buttons, open detail', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[placeholder="Email"]', 'admin@eco.local');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('text=Entrar');
  await page.waitForURL('**/shipments');

  await expect(page.getByText('Export CSV')).toBeVisible();
  await expect(page.getByText('Export PDF')).toBeVisible();

  const firstShipment = page.locator('table a').first();
  await expect(firstShipment).toBeVisible();
  await firstShipment.click();
  await page.waitForURL('**/shipments/**');

  await expect(page.getByText('Detalle envio')).toBeVisible();
  await expect(page.getByText('Tracking')).toBeVisible();
  await expect(page.getByText('POD')).toBeVisible();
  await expect(page.getByText('Incidencias')).toBeVisible();
  await expect(page.getByText('Paradas')).toBeVisible();
});
