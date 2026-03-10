import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { ExportActionsModal } from '../../components/common/ExportActionsModal';
import type { AuditLogEntry } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { hasExportAccess } from '../../core/auth/exportAccess';
import { apiClient } from '../../services/apiClient';

type AuditResource =
  | ''
  | 'settlement'
  | 'adjustment'
  | 'advance'
  | 'tariff'
  | 'quality_threshold'
  | 'user'
  | 'role'
  | 'subcontractor'
  | 'driver'
  | 'vehicle'
  | 'route'
  | 'shipment'
  | 'incident'
  | 'workforce'
  | 'compliance_document'
  | 'vehicle_control';

export function parseMetadata(metadata: AuditLogEntry['metadata']): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown;
      if (typeof parsed === 'object' && parsed && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: metadata };
    } catch {
      return { value: metadata };
    }
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return { value: String(metadata) };
}

export function getEntityLink(row: AuditLogEntry): { to: string; label: string } | null {
  const metadata = parseMetadata(row.metadata);
  const settlementId = typeof metadata.settlement_id === 'string' ? metadata.settlement_id : null;
  const routeId = typeof metadata.route_id === 'string' ? metadata.route_id : null;
  const shipmentId = typeof metadata.shipment_id === 'string' ? metadata.shipment_id : null;
  const incidentId = typeof metadata.incident_id === 'string' ? metadata.incident_id : null;
  const userId = typeof metadata.user_id === 'string' ? metadata.user_id : null;
  const roleId = typeof metadata.role_id === 'string' ? metadata.role_id : null;
  const subcontractorId = typeof metadata.subcontractor_id === 'string' ? metadata.subcontractor_id : null;
  const driverId = typeof metadata.driver_id === 'string' ? metadata.driver_id : null;
  const vehicleId = typeof metadata.vehicle_id === 'string' ? metadata.vehicle_id : null;
  const vehicleControlId = typeof metadata.vehicle_control_id === 'string' ? metadata.vehicle_control_id : null;
  const employeeId = typeof metadata.employee_id === 'string' ? metadata.employee_id : null;

  if (settlementId) return { to: `/settlements/${settlementId}`, label: 'Liquidación' };
  if (routeId) return { to: `/routes/${routeId}`, label: 'Ruta' };
  if (shipmentId) return { to: `/shipments/${shipmentId}`, label: 'Envío' };
  if (incidentId) return { to: `/incidents?incident_id=${encodeURIComponent(incidentId)}`, label: 'Incidencia' };
  if (userId) return { to: `/users/${userId}`, label: 'Usuario' };
  if (roleId) return { to: `/roles/${roleId}`, label: 'Rol' };
  if (vehicleControlId) return { to: `/fleet-controls?focus=control&id=${encodeURIComponent(vehicleControlId)}`, label: 'Control flota' };
  if (subcontractorId) return { to: `/partners?focus=subcontractor&id=${encodeURIComponent(subcontractorId)}`, label: 'Subcontrata' };
  if (driverId) return { to: `/partners?focus=driver&id=${encodeURIComponent(driverId)}`, label: 'Conductor' };
  if (vehicleId) return { to: `/fleet-controls?vehicle_id=${encodeURIComponent(vehicleId)}`, label: 'Vehículo' };
  if (employeeId) return { to: `/workforce?id=${encodeURIComponent(employeeId)}`, label: 'Empleado' };
  return null;
}

export function AuditOpsPage() {
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [resource, setResource] = useState<AuditResource>('');
  const [resourceId, setResourceId] = useState('');
  const [eventPrefix, setEventPrefix] = useState('');
  const [actor, setActor] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const canExport = hasExportAccess('audit', sessionStore.getRoles());

  const runSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.getAuditLogs({
        resource: resource || undefined,
        id: resourceId.trim() || undefined,
        event: eventPrefix.trim() || undefined,
        actor: actor.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: 1,
        perPage: 100,
      });
      setRows(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar auditoría.');
    } finally {
      setLoading(false);
    }
  };

  const metadataPretty = useMemo(
    () => rows.map((row) => ({ id: row.id, value: JSON.stringify(parseMetadata(row.metadata)) })),
    [rows]
  );

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle>Auditoría operativa global</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="form-row">
            <div>
              <label htmlFor="audit-resource">Recurso</label>
              <Select id="audit-resource" value={resource} onChange={(event) => setResource(event.target.value as AuditResource)}>
                <option value="">Todos</option>
                <option value="settlement">Liquidaciones</option>
                <option value="advance">Anticipos</option>
                <option value="subcontractor">Subcontratas</option>
                <option value="driver">Conductores</option>
                <option value="vehicle">Vehículos</option>
                <option value="shipment">Envíos</option>
                <option value="route">Rutas</option>
                <option value="incident">Incidencias</option>
                <option value="workforce">Personal</option>
                <option value="compliance_document">Documentación</option>
                <option value="vehicle_control">Control flota</option>
                <option value="quality_threshold">Umbrales calidad</option>
                <option value="user">Usuarios</option>
                <option value="role">Roles</option>
              </Select>
            </div>
            <div>
              <label htmlFor="audit-resource-id">ID recurso</label>
              <Input id="audit-resource-id" value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="UUID opcional" />
            </div>
            <div>
              <label htmlFor="audit-event">Prefijo evento</label>
              <Input id="audit-event" value={eventPrefix} onChange={(event) => setEventPrefix(event.target.value)} placeholder="Ej. routes. / shipments." />
            </div>
            <div>
              <label htmlFor="audit-actor">Actor</label>
              <Input id="audit-actor" value={actor} onChange={(event) => setActor(event.target.value)} placeholder="Nombre o user id" />
            </div>
            <div>
              <label htmlFor="audit-from">Fecha desde</label>
              <Input id="audit-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div>
              <label htmlFor="audit-to">Fecha hasta</label>
              <Input id="audit-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </div>
          <div className="inline-actions toolbar-spaced">
            <Button type="button" onClick={() => { void runSearch(); }} disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            <ExportActionsModal
              title="Exportar auditoría"
              triggerDisabled={!canExport}
              actions={[
                {
                  id: 'audit-csv',
                  label: 'CSV',
                  run: () => apiClient.exportAuditLogsCsv({
                    resource: resource || undefined,
                    id: resourceId.trim() || undefined,
                    event: eventPrefix.trim() || undefined,
                    actor: actor.trim() || undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                  }),
                },
              ]}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResource('');
                setResourceId('');
                setEventPrefix('');
                setActor('');
                setDateFrom('');
                setDateTo('');
                setRows([]);
              }}
            >
              Limpiar
            </Button>
          </div>
          {error ? <div className="helper error">{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const link = getEntityLink(row);
                  const meta = metadataPretty.find((item) => item.id === row.id)?.value ?? '{}';
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.created_at).toLocaleString('es-ES')}</TableCell>
                      <TableCell>{row.event}</TableCell>
                      <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                      <TableCell>
                        {link ? <Link to={link.to} className="sidebar-user-link">{link.label}</Link> : '-'}
                      </TableCell>
                      <TableCell>{meta}</TableCell>
                    </TableRow>
                  );
                })}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>Sin resultados. Ejecuta una búsqueda.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}
