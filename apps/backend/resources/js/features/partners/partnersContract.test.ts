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

  test('bulk status update changes selected rows', async () => {
    const subcontractor = await mockApi.createSubcontractor({
      legal_name: 'Bulk Partner SL',
      status: 'active',
    });
    const driver = await mockApi.createDriver({
      code: 'DRV-BULK-001',
      name: 'Driver Bulk',
      subcontractor_id: subcontractor.id,
      employment_type: 'subcontractor',
      status: 'active',
    });
    const vehicle = await mockApi.createVehicle({
      code: 'VEH-BULK-001',
      subcontractor_id: subcontractor.id,
      assigned_driver_id: driver.id,
      status: 'active',
    });

    const subResult = await mockApi.bulkUpdateSubcontractorStatus([subcontractor.id], 'suspended');
    const driverResult = await mockApi.bulkUpdateDriverStatus([driver.id], 'suspended');
    const vehicleResult = await mockApi.bulkUpdateVehicleStatus([vehicle.id], 'maintenance');

    expect(subResult.affected_count).toBe(1);
    expect(driverResult.affected_count).toBe(1);
    expect(vehicleResult.affected_count).toBe(1);

    const refreshedSubs = await mockApi.getSubcontractors({ q: 'Bulk Partner SL' });
    const refreshedDrivers = await mockApi.getDrivers({ subcontractorId: subcontractor.id });
    const refreshedVehicles = await mockApi.getVehicles({ subcontractorId: subcontractor.id });
    expect(refreshedSubs.find((row) => row.id === subcontractor.id)?.status).toBe('suspended');
    expect(refreshedDrivers.find((row) => row.id === driver.id)?.status).toBe('suspended');
    expect(refreshedVehicles.find((row) => row.id === vehicle.id)?.status).toBe('maintenance');
  });
});
