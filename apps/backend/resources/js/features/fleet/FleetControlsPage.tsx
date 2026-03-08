import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { VehicleControlSummary, VehicleSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

type ControlType = 'fuel' | 'insurance' | 'itv' | 'maintenance' | 'other';

export function FleetControlsPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<VehicleControlSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ControlType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [focusedControlId, setFocusedControlId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [controlType, setControlType] = useState<ControlType>('fuel');
  const [eventDate, setEventDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [odometer, setOdometer] = useState('');
  const [provider, setProvider] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const load = async (overrides?: {
    vehicleFilter?: string;
    typeFilter?: 'all' | ControlType;
    fromDate?: string;
    toDate?: string;
  }) => {
    setError('');
    const effectiveVehicleFilter = overrides?.vehicleFilter ?? vehicleFilter;
    const effectiveTypeFilter = overrides?.typeFilter ?? typeFilter;
    const effectiveFromDate = overrides?.fromDate ?? fromDate;
    const effectiveToDate = overrides?.toDate ?? toDate;
    try {
      const [controlRows, vehicleRows] = await Promise.all([
        apiClient.getVehicleControls({
          vehicleId: effectiveVehicleFilter || undefined,
          controlType: effectiveTypeFilter === 'all' ? undefined : effectiveTypeFilter,
          dateFrom: effectiveFromDate || undefined,
          dateTo: effectiveToDate || undefined,
        }),
        apiClient.getVehicles({ limit: 200 }),
      ]);
      setRows(controlRows);
      setVehicles(vehicleRows);
      if (!vehicleId && vehicleRows[0]?.id) setVehicleId(vehicleRows[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar control de vehículos.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const vehicleIdParam = searchParams.get('vehicle_id') ?? '';
    const controlTypeParam = searchParams.get('control_type') ?? '';
    const fromDateParam = searchParams.get('date_from') ?? '';
    const toDateParam = searchParams.get('date_to') ?? '';
    const focus = searchParams.get('focus') ?? '';
    const id = searchParams.get('id') ?? '';
    const nextTypeFilter = controlTypeParam === 'fuel'
      || controlTypeParam === 'insurance'
      || controlTypeParam === 'itv'
      || controlTypeParam === 'maintenance'
      || controlTypeParam === 'other'
      ? controlTypeParam
      : 'all';

    setVehicleFilter(vehicleIdParam);
    setTypeFilter(nextTypeFilter);
    setFromDate(fromDateParam);
    setToDate(toDateParam);
    setFocusedControlId(focus === 'control' ? id : '');

    if (vehicleIdParam || controlTypeParam || fromDateParam || toDateParam) {
      void load({
        vehicleFilter: vehicleIdParam,
        typeFilter: nextTypeFilter,
        fromDate: fromDateParam,
        toDate: toDateParam,
      });
    }
  }, [searchParams]);

  const visibleRows = useMemo(
    () => (focusedControlId ? rows.filter((item) => item.id === focusedControlId) : rows),
    [rows, focusedControlId]
  );

  const summary = useMemo(() => ({
    total: visibleRows.length,
    fuel: visibleRows.filter((item) => item.control_type === 'fuel').length,
    insurance: visibleRows.filter((item) => item.control_type === 'insurance').length,
    itv: visibleRows.filter((item) => item.control_type === 'itv').length,
    maintenance: visibleRows.filter((item) => item.control_type === 'maintenance').length,
    amount: visibleRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0),
  }), [visibleRows]);

  const resetForm = () => {
    setEditingId('');
    setControlType('fuel');
    setEventDate('');
    setDueDate('');
    setAmount('');
    setOdometer('');
    setProvider('');
    setReference('');
    setNotes('');
    if (vehicles[0]?.id) setVehicleId(vehicles[0].id);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: VehicleControlSummary) => {
    setEditingId(row.id);
    setVehicleId(row.vehicle_id);
    setControlType(row.control_type);
    setEventDate(row.event_date);
    setDueDate(row.due_date ?? '');
    setAmount(row.amount != null ? String(row.amount) : '');
    setOdometer(row.odometer_km != null ? String(row.odometer_km) : '');
    setProvider(row.provider ?? '');
    setReference(row.reference ?? '');
    setNotes(row.notes ?? '');
    setOpen(true);
  };

  const submit = async () => {
    setMessage('');
    setError('');
    if (!vehicleId) {
      setError('Selecciona vehículo.');
      return;
    }
    if (!eventDate) {
      setError('La fecha del evento es obligatoria.');
      return;
    }

    const payload = {
      vehicle_id: vehicleId,
      control_type: controlType,
      event_date: eventDate,
      due_date: dueDate || undefined,
      amount: amount ? Number(amount) : undefined,
      odometer_km: odometer ? Number(odometer) : undefined,
      provider: provider.trim() || undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (editingId) {
        await apiClient.updateVehicleControl(editingId, {
          control_type: payload.control_type,
          event_date: payload.event_date,
          due_date: payload.due_date,
          amount: payload.amount,
          odometer_km: payload.odometer_km,
          provider: payload.provider,
          reference: payload.reference,
          notes: payload.notes,
        });
        setMessage('Control actualizado.');
      } else {
        await apiClient.createVehicleControl(payload);
        setMessage('Control registrado.');
      }
      setOpen(false);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar control.');
    }
  };

  const remove = async (row: VehicleControlSummary) => {
    if (!window.confirm(`Eliminar control ${row.control_type} del ${row.event_date}?`)) return;
    setMessage('');
    setError('');
    try {
      await apiClient.deleteVehicleControl(row.id);
      setMessage('Control eliminado.');
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar control.');
    }
  };

  return (
    <section className="page-grid">
      <div className="inline-actions">
        <Link to="/dashboard" className="helper">Dashboard</Link>
        <span className="helper">/</span>
        <span className="helper">Control de Flota</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Controles avanzados de vehículos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="page-grid four">
            <div className="card-row"><strong>{summary.total}</strong><span className="helper">Registros</span></div>
            <div className="card-row"><strong>{summary.fuel}</strong><span className="helper">Repostajes</span></div>
            <div className="card-row"><strong>{summary.insurance + summary.itv}</strong><span className="helper">Seguros + ITV</span></div>
            <div className="card-row"><strong>{summary.maintenance}</strong><span className="helper">Mantenimientos</span></div>
          </div>
          <div className="helper" style={{ marginTop: 6 }}>Gasto acumulado mostrado: {summary.amount.toFixed(2)} EUR</div>
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <Button type="button" onClick={openCreate}>+ Nuevo control</Button>
            <Select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}>
              <option value="">Vehículo: todos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.code}{vehicle.plate_number ? ` (${vehicle.plate_number})` : ''}</option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <option value="all">Tipo: todos</option>
              <option value="fuel">Repostaje</option>
              <option value="insurance">Seguro</option>
              <option value="itv">ITV</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="other">Otro</option>
            </Select>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            <Button type="button" variant="secondary" onClick={() => { void load(); }}>Aplicar</Button>
          </div>
          {message ? <div className="helper" style={{ color: 'var(--success)' }}>{message}</div> : null}
          {error ? <div className="helper" style={{ color: 'var(--danger)' }}>{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de controles</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.vehicle_code ?? row.vehicle_id}{row.plate_number ? ` (${row.plate_number})` : ''}</TableCell>
                    <TableCell>{row.control_type}</TableCell>
                    <TableCell>{row.event_date}</TableCell>
                    <TableCell>{row.due_date ?? '-'}</TableCell>
                    <TableCell>{row.amount != null ? `${Number(row.amount).toFixed(2)} €` : '-'}</TableCell>
                    <TableCell>{row.provider ?? '-'}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button type="button" variant="outline" onClick={() => openEdit(row)}>Editar</Button>
                        <Button type="button" variant="destructive" onClick={() => { void remove(row); }}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>Sin datos.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Editar control' : 'Nuevo control'}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => { void submit(); }}>{editingId ? 'Guardar cambios' : 'Registrar control'}</Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label htmlFor="fleet-vehicle">Vehículo</label>
            <Select id="fleet-vehicle" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} disabled={Boolean(editingId)}>
              <option value="">Selecciona vehículo</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.code}{vehicle.plate_number ? ` (${vehicle.plate_number})` : ''}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="fleet-type">Tipo</label>
            <Select id="fleet-type" value={controlType} onChange={(event) => setControlType(event.target.value as ControlType)}>
              <option value="fuel">Repostaje</option>
              <option value="insurance">Seguro</option>
              <option value="itv">ITV</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="other">Otro</option>
            </Select>
          </div>
          <div>
            <label htmlFor="fleet-event-date">Fecha evento</label>
            <Input id="fleet-event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="fleet-due-date">Vencimiento</label>
            <Input id="fleet-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="fleet-amount">Importe</label>
            <Input id="fleet-amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="fleet-odo">Odómetro (km)</label>
            <Input id="fleet-odo" value={odometer} onChange={(event) => setOdometer(event.target.value)} placeholder="102345" />
          </div>
          <div>
            <label htmlFor="fleet-provider">Proveedor</label>
            <Input id="fleet-provider" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Repsol, taller..." />
          </div>
          <div>
            <label htmlFor="fleet-ref">Referencia</label>
            <Input id="fleet-ref" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Factura, ticket..." />
          </div>
          <div>
            <label htmlFor="fleet-notes">Notas</label>
            <Input id="fleet-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle" />
          </div>
        </div>
      </Modal>
    </section>
  );
}
