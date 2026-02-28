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
  const [driverCode, setDriverCode] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverSubcontractorId, setDriverSubcontractorId] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleSubcontractorId, setVehicleSubcontractorId] = useState('');
  const [vehicleDriverId, setVehicleDriverId] = useState('');

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
        status: 'active',
        payment_terms: 'monthly',
      });
      setSubcontractorName('');
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
        name: driverName,
        employment_type: 'subcontractor',
        subcontractor_id: driverSubcontractorId || undefined,
      });
      setDriverCode('');
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
        plate_number: vehiclePlate || undefined,
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
              <Button type="submit">Crear subcontrata</Button>
            </form>
            <form className="inline-actions" onSubmit={onCreateDriver}>
              <Input value={driverCode} onChange={(e) => setDriverCode(e.target.value)} placeholder="Codigo driver" required />
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
              <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="Matricula" />
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {subcontractors.map((subcontractor) => (
                  <TableRow key={subcontractor.id}>
                    <TableCell>{subcontractor.legal_name}</TableCell>
                    <TableCell>{subcontractor.tax_id ?? '-'}</TableCell>
                    <TableCell>{subcontractor.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          <h3>Drivers</h3>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>{driver.code}</TableCell>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>{driver.subcontractor_name ?? '-'}</TableCell>
                    <TableCell>{driver.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          {message && <p className="helper">{message}</p>}
          {error && <p className="helper">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}

