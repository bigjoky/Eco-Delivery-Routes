import { test, expect } from '@playwright/test';

test('incidents flow: resolve and filter by status', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[placeholder="Email"]', 'admin@eco.local');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('text=Entrar');

  await page.goto('/incidents');
  await expect(page.getByText('Incidencias recientes')).toBeVisible({ timeout: 60000 });

  const resolveButton = page.getByRole('button', { name: 'Resolver' }).first();
  await expect(resolveButton).toBeVisible();
  await resolveButton.click();

  const statusFilter = page.locator('label:has-text("Estado") + select').first();
  await statusFilter.selectOption('resolved');
  await expect(page.getByText('resuelta').first()).toBeVisible();
});
