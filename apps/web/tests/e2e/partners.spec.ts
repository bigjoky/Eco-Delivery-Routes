import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.fill('input[placeholder="Email"]', 'admin@eco.local');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('text=Entrar');
}

test('partners flow: edit subcontractor, driver and vehicle', async ({ page }) => {
  await login(page);
  await page.click('text=Partners');
  await expect(page.getByRole('heading', { name: 'Subcontratas + Drivers + Vehiculos' })).toBeVisible();

  await page.locator('[data-testid^="edit-subcontractor-"]').first().click();
  await page.locator('input[placeholder="Nombre"]').fill('Ruta Sur Express SL Editada');
  await page.getByTestId('save-subcontractor').click();
  await expect(page.getByText('Subcontrata actualizada')).toBeVisible();

  await page.locator('[data-testid^="edit-driver-"]').first().click();
  await page.locator('input[placeholder="DNI/NIE"]').last().fill('12345679Z');
  await page.getByTestId('save-driver').click();
  await expect(page.getByText('Driver actualizado')).toBeVisible();

  await page.locator('[data-testid^="edit-vehicle-"]').first().click();
  await page.locator('input[placeholder="Matricula"]').last().fill('9999-MLG');
  await page.getByTestId('save-vehicle').click();
  await expect(page.getByText('Vehiculo actualizado')).toBeVisible();
});

test('partners flow: prevents subcontractor-driver mismatch on vehicle creation', async ({ page }) => {
  await login(page);
  await page.click('text=Partners');
  await expect(page.getByRole('heading', { name: 'Subcontratas + Drivers + Vehiculos' })).toBeVisible();

  const ts = Date.now().toString().slice(-6);
  const subcontractorForm = page.locator('form').nth(0);
  await subcontractorForm.locator('input[placeholder="Nueva subcontrata"]').fill(`Sub Demo ${ts}`);
  await subcontractorForm.locator('input[placeholder="CIF/NIF"]').fill(`B${ts}`);
  await subcontractorForm.locator('button:has-text("Crear subcontrata")').click();
  await expect(page.getByText('Subcontrata creada')).toBeVisible();

  const driverForm = page.locator('form').nth(1);
  await driverForm.locator('input[placeholder="Codigo driver"]').fill(`DRV-${ts}`);
  await driverForm.locator('input[placeholder="DNI/NIE"]').first().fill(`Z${ts}`);
  await driverForm.locator('input[placeholder="Nombre driver"]').fill(`Driver ${ts}`);
  await driverForm.locator('select').selectOption({ label: `Sub Demo ${ts}` });
  await driverForm.locator('button:has-text("Crear driver")').click();
  await expect(page.getByText('Driver creado')).toBeVisible();

  const vehicleForm = page.locator('form').nth(2);
  await vehicleForm.locator('input[placeholder="Codigo vehiculo"]').fill(`VEH-${ts}`);
  await vehicleForm.locator('input[placeholder="Matricula"]').first().fill(`M-${ts}`);
  await vehicleForm.locator('select').nth(0).selectOption({ label: 'Ruta Sur Express SL' });
  await vehicleForm.locator('select').nth(1).selectOption({ label: `DRV-${ts} - Driver ${ts}` });
  await vehicleForm.locator('button:has-text("Crear vehiculo")').click();

  await expect(page.getByText('El driver seleccionado pertenece a otra subcontrata.')).toBeVisible();
});
