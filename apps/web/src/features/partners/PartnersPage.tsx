import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DriverSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function PartnersPage() {
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [subcontractorName, setSubcontractorName] = useState('');
  const [subcontractorTaxId, setSubcontractorTaxId] = useState('');
  const [driverCode, setDriverCode] = useState('');
  const [driverDni, setDriverDni] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverSubcontractorId, setDriverSubcontractorId] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleSubcontractorId, setVehicleSubcontractorId] = useState('');
  const [vehicleDriverId, setVehicleDriverId] = useState('');

  const [editingSubcontractorId, setEditingSubcontractorId] = useState('');
  const [editSubcontractorName, setEditSubcontractorName] = useState('');
  const [editSubcontractorTaxId, setEditSubcontractorTaxId] = useState('');
  const [editSubcontractorStatus, setEditSubcontractorStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [editSubcontractorPaymentTerms, setEditSubcontractorPaymentTerms] = useState('monthly');

  const [editingDriverId, setEditingDriverId] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverDni, setEditDriverDni] = useState('');
  const [editDriverStatus, setEditDriverStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [editDriverSubcontractorId, setEditDriverSubcontractorId] = useState('');

  const [editingVehicleId, setEditingVehicleId] = useState('');
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [editVehicleStatus, setEditVehicleStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
  const [editVehicleSubcontractorId, setEditVehicleSubcontractorId] = useState('');
  const [editVehicleDriverId, setEditVehicleDriverId] = useState('');

  const load = async () => {
    setError('');
    try {
      const [subRows, driverRows, vehicleRows] = await Promise.all([
        apiClient.getSubcontractors({ limit: 50 }),
        apiClient.getDrivers({ limit: 50 }),
        apiClient.getVehicles({ limit: 50 }),
      ]);
      setSubcontractors(subRows);
      setDrivers(driverRows);
      setVehicles(vehicleRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el modulo de partners');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreateSubcontractor = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await apiClient.createSubcontractor({
        legal_name: subcontractorName,
        tax_id: subcontractorTaxId,
        status: 'active',
        payment_terms: 'monthly',
      });
      setSubcontractorName('');
      setSubcontractorTaxId('');
      setMessage('Subcontrata creada');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la subcontrata');
    }
  };

  const onCreateDriver = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await apiClient.createDriver({
        code: driverCode,
        dni: driverDni,
        name: driverName,
        employment_type: 'subcontractor',
        subcontractor_id: driverSubcontractorId || undefined,
      });
      setDriverCode('');
      setDriverDni('');
      setDriverName('');
      setMessage('Driver creado');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el driver');
    }
  };

  const onCreateVehicle = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await apiClient.createVehicle({
        code: vehicleCode,
        plate_number: vehiclePlate,
        vehicle_type: 'van',
        status: 'active',
        subcontractor_id: vehicleSubcontractorId || undefined,
        assigned_driver_id: vehicleDriverId || undefined,
      });
      setVehicleCode('');
      setVehiclePlate('');
      setMessage('Vehiculo creado');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el vehiculo');
    }
  };

  const startEditSubcontractor = (row: SubcontractorSummary) => {
    setEditingSubcontractorId(row.id);
    setEditSubcontractorName(row.legal_name);
    setEditSubcontractorTaxId(row.tax_id ?? '');
    setEditSubcontractorStatus((row.status as 'active' | 'inactive' | 'suspended') ?? 'active');
    setEditSubcontractorPaymentTerms(row.payment_terms ?? 'monthly');
  };

  const saveSubcontractor = async () => {
    if (!editingSubcontractorId) return;
    setMessage('');
    setError('');
    try {
      await apiClient.updateSubcontractor(editingSubcontractorId, {
        legal_name: editSubcontractorName,
        tax_id: editSubcontractorTaxId,
        status: editSubcontractorStatus,
        payment_terms: editSubcontractorPaymentTerms,
      });
      setEditingSubcontractorId('');
      setMessage('Subcontrata actualizada');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar la subcontrata');
    }
  };

  const startEditDriver = (row: DriverSummary) => {
    setEditingDriverId(row.id);
    setEditDriverName(row.name);
    setEditDriverDni(row.dni ?? '');
    setEditDriverStatus((row.status as 'active' | 'inactive' | 'suspended') ?? 'active');
    setEditDriverSubcontractorId(row.subcontractor_id ?? '');
  };

  const saveDriver = async () => {
    if (!editingDriverId) return;
    setMessage('');
    setError('');
    try {
      await apiClient.updateDriver(editingDriverId, {
        name: editDriverName,
        dni: editDriverDni,
        status: editDriverStatus,
        subcontractor_id: editDriverSubcontractorId || null,
      });
      setEditingDriverId('');
      setMessage('Driver actualizado');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el driver');
    }
  };

  const startEditVehicle = (row: VehicleSummary) => {
    setEditingVehicleId(row.id);
    setEditVehiclePlate(row.plate_number ?? '');
    setEditVehicleStatus((row.status as 'active' | 'inactive' | 'maintenance') ?? 'active');
    setEditVehicleSubcontractorId(row.subcontractor_id ?? '');
    setEditVehicleDriverId(row.assigned_driver_id ?? '');
  };

  const saveVehicle = async () => {
    if (!editingVehicleId) return;
    setMessage('');
    setError('');
    try {
      await apiClient.updateVehicle(editingVehicleId, {
        plate_number: editVehiclePlate,
        status: editVehicleStatus,
        subcontractor_id: editVehicleSubcontractorId || null,
        assigned_driver_id: editVehicleDriverId || null,
      });
      setEditingVehicleId('');
      setMessage('Vehiculo actualizado');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el vehiculo');
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Subcontratas + Drivers + Vehiculos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="page-grid two">
            <form className="inline-actions" onSubmit={onCreateSubcontractor}>
              <Input value={subcontractorName} onChange={(e) => setSubcontractorName(e.target.value)} placeholder="Nueva subcontrata" required />
              <Input value={subcontractorTaxId} onChange={(e) => setSubcontractorTaxId(e.target.value)} placeholder="CIF/NIF" required />
              <Button type="submit">Crear subcontrata</Button>
            </form>
            <form className="inline-actions" onSubmit={onCreateDriver}>
              <Input value={driverCode} onChange={(e) => setDriverCode(e.target.value)} placeholder="Codigo driver" required />
              <Input value={driverDni} onChange={(e) => setDriverDni(e.target.value)} placeholder="DNI/NIE" required />
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Nombre driver" required />
              <Select value={driverSubcontractorId} onChange={(e) => setDriverSubcontractorId(e.target.value)}>
                <option value="">Sin subcontrata</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                ))}
              </Select>
              <Button type="submit">Crear driver</Button>
            </form>
            <form className="inline-actions" onSubmit={onCreateVehicle}>
              <Input value={vehicleCode} onChange={(e) => setVehicleCode(e.target.value)} placeholder="Codigo vehiculo" required />
              <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="Matricula" required />
              <Select value={vehicleSubcontractorId} onChange={(e) => setVehicleSubcontractorId(e.target.value)}>
                <option value="">Sin subcontrata</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                ))}
              </Select>
              <Select value={vehicleDriverId} onChange={(e) => setVehicleDriverId(e.target.value)}>
                <option value="">Sin driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.code} - {driver.name}</option>
                ))}
              </Select>
              <Button type="submit">Crear vehiculo</Button>
            </form>
          </div>

          <h3>Subcontratas</h3>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tax ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subcontractors.map((subcontractor) => (
                  <TableRow key={subcontractor.id}>
                    <TableCell>{subcontractor.legal_name}</TableCell>
                    <TableCell>{subcontractor.tax_id ?? '-'}</TableCell>
                    <TableCell>{subcontractor.status}</TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" onClick={() => startEditSubcontractor(subcontractor)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          {editingSubcontractorId ? (
            <div className="inline-actions">
              <Input value={editSubcontractorName} onChange={(e) => setEditSubcontractorName(e.target.value)} placeholder="Nombre" />
              <Input value={editSubcontractorTaxId} onChange={(e) => setEditSubcontractorTaxId(e.target.value)} placeholder="CIF/NIF" />
              <Select value={editSubcontractorStatus} onChange={(e) => setEditSubcontractorStatus(e.target.value as 'active' | 'inactive' | 'suspended')}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </Select>
              <Input value={editSubcontractorPaymentTerms} onChange={(e) => setEditSubcontractorPaymentTerms(e.target.value)} placeholder="payment terms" />
              <Button type="button" onClick={saveSubcontractor}>Guardar subcontrata</Button>
              <Button type="button" variant="outline" onClick={() => setEditingSubcontractorId('')}>Cancelar</Button>
            </div>
          ) : null}

          <h3>Drivers</h3>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>{driver.code}</TableCell>
                    <TableCell>{driver.dni ?? '-'}</TableCell>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>{driver.subcontractor_name ?? '-'}</TableCell>
                    <TableCell>{driver.status}</TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" onClick={() => startEditDriver(driver)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          {editingDriverId ? (
            <div className="inline-actions">
              <Input value={editDriverName} onChange={(e) => setEditDriverName(e.target.value)} placeholder="Nombre" />
              <Input value={editDriverDni} onChange={(e) => setEditDriverDni(e.target.value)} placeholder="DNI/NIE" />
              <Select value={editDriverStatus} onChange={(e) => setEditDriverStatus(e.target.value as 'active' | 'inactive' | 'suspended')}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </Select>
              <Select value={editDriverSubcontractorId} onChange={(e) => setEditDriverSubcontractorId(e.target.value)}>
                <option value="">Sin subcontrata</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                ))}
              </Select>
              <Button type="button" onClick={saveDriver}>Guardar driver</Button>
              <Button type="button" variant="outline" onClick={() => setEditingDriverId('')}>Cancelar</Button>
            </div>
          ) : null}

          <h3>Vehiculos</h3>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Matricula</TableHead>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>{vehicle.code}</TableCell>
                    <TableCell>{vehicle.plate_number ?? '-'}</TableCell>
                    <TableCell>{vehicle.subcontractor_name ?? '-'}</TableCell>
                    <TableCell>{vehicle.assigned_driver_code ?? '-'}</TableCell>
                    <TableCell>{vehicle.status}</TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" onClick={() => startEditVehicle(vehicle)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          {editingVehicleId ? (
            <div className="inline-actions">
              <Input value={editVehiclePlate} onChange={(e) => setEditVehiclePlate(e.target.value)} placeholder="Matricula" />
              <Select value={editVehicleStatus} onChange={(e) => setEditVehicleStatus(e.target.value as 'active' | 'inactive' | 'maintenance')}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="maintenance">maintenance</option>
              </Select>
              <Select value={editVehicleSubcontractorId} onChange={(e) => setEditVehicleSubcontractorId(e.target.value)}>
                <option value="">Sin subcontrata</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                ))}
              </Select>
              <Select value={editVehicleDriverId} onChange={(e) => setEditVehicleDriverId(e.target.value)}>
                <option value="">Sin driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.code} - {driver.name}</option>
                ))}
              </Select>
              <Button type="button" onClick={saveVehicle}>Guardar vehiculo</Button>
              <Button type="button" variant="outline" onClick={() => setEditingVehicleId('')}>Cancelar</Button>
            </div>
          ) : null}

          {message ? <p className="helper">{message}</p> : null}
          {error ? <p className="helper error">{error}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
