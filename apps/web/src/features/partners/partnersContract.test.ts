import { describe, expect, test } from 'vitest';
import { mockApi } from '../../mocks/mockApi';

describe('partners module contract (mock)', () => {
  test('creates subcontractor driver and vehicle and lists them', async () => {
    const subcontractor = await mockApi.createSubcontractor({
      legal_name: 'Partners Contract SL',
      status: 'active',
    });
    const driver = await mockApi.createDriver({
      code: 'DRV-CONTRACT-001',
      name: 'Driver Contract',
      subcontractor_id: subcontractor.id,
      employment_type: 'subcontractor',
    });
    const vehicle = await mockApi.createVehicle({
      code: 'VEH-CONTRACT-001',
      subcontractor_id: subcontractor.id,
      assigned_driver_id: driver.id,
      status: 'active',
    });

    expect(subcontractor.id).toBeTruthy();
    expect(driver.id).toBeTruthy();
    expect(vehicle.id).toBeTruthy();

    const drivers = await mockApi.getDrivers({ subcontractorId: subcontractor.id });
    const vehicles = await mockApi.getVehicles({ subcontractorId: subcontractor.id });
    expect(drivers.some((row) => row.id === driver.id)).toBe(true);
    expect(vehicles.some((row) => row.id === vehicle.id)).toBe(true);
  });
});

