import { expect, test } from '@playwright/test';

test('dashboard flow: shows overview and allows operational drill-down', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[placeholder="Email"]', 'admin@eco.local');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('text=Entrar');

  await expect(page.getByRole('heading', { name: 'Everything at a glance' })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('SLA incidencias')).toBeVisible();
  await expect(page.getByText('Productividad por hub')).toBeVisible();

  const incidentsLink = page.getByRole('link', { name: 'Incidencias' }).first();
  await incidentsLink.click();
  await expect(page).toHaveURL(/\/incidents/);

  await page.goto('/dashboard');
  const firstRouteLink = page.locator('a[href^="/routes/"]').first();
  await expect(firstRouteLink).toBeVisible();
  await firstRouteLink.click();
  await expect(page).toHaveURL(/\/routes\//);
});
