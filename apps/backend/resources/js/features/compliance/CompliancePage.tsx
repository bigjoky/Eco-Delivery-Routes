import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { ComplianceDocumentSummary, DriverSummary, SubcontractorSummary, VehicleSummary, WorkforceEmployeeSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

type ScopeType = 'company' | 'subcontractor' | 'employee' | 'driver' | 'vehicle' | 'operation';
type DocumentType = 'cae' | 'insurance' | 'itv' | 'contract' | 'training' | 'license' | 'prevention' | 'other';
type DocStatus = 'valid' | 'expiring' | 'expired' | 'pending';

export function CompliancePage() {
  const [rows, setRows] = useState<ComplianceDocumentSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [employees, setEmployees] = useState<WorkforceEmployeeSummary[]>([]);
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | ScopeType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DocStatus>('all');
  const [expiresBefore, setExpiresBefore] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [scopeType, setScopeType] = useState<ScopeType>('subcontractor');
  const [scopeId, setScopeId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('cae');
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [status, setStatus] = useState<DocStatus>('pending');
  const [fileUrl, setFileUrl] = useState('');

  const scopeOptions = useMemo(() => {
    if (scopeType === 'subcontractor') {
      return subcontractors.map((item) => ({ id: item.id, label: item.legal_name }));
    }
    if (scopeType === 'driver') {
      return drivers.map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (scopeType === 'vehicle') {
      return vehicles.map((item) => ({ id: item.id, label: `${item.code}${item.plate_number ? ` (${item.plate_number})` : ''}` }));
    }
    if (scopeType === 'employee') {
      return employees.map((item) => ({ id: item.id, label: `${item.name} (${item.document_id})` }));
    }
    return [];
  }, [scopeType, subcontractors, drivers, vehicles, employees]);

  const scopeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    subcontractors.forEach((item) => map.set(item.id, item.legal_name));
    drivers.forEach((item) => map.set(item.id, `${item.code} - ${item.name}`));
    vehicles.forEach((item) => map.set(item.id, `${item.code}${item.plate_number ? ` (${item.plate_number})` : ''}`));
    employees.forEach((item) => map.set(item.id, `${item.name} (${item.document_id})`));
    return map;
  }, [subcontractors, drivers, vehicles, employees]);

  const load = async () => {
    setError('');
    try {
      const [documents, subRows, driverRows, vehicleRows, employeeRows] = await Promise.all([
        apiClient.getComplianceDocuments({
          q: query || undefined,
          scopeType: scopeFilter === 'all' ? undefined : scopeFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          expiresBefore: expiresBefore || undefined,
        }),
        apiClient.getSubcontractors({ limit: 100 }),
        apiClient.getDrivers({ limit: 200 }),
        apiClient.getVehicles({ limit: 200 }),
        apiClient.getWorkforce(),
      ]);
      setRows(documents);
      setSubcontractors(subRows);
      setDrivers(driverRows);
      setVehicles(vehicleRows);
      setEmployees(employeeRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar documentación CAE.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => ({
    total: rows.length,
    valid: rows.filter((item) => item.status === 'valid').length,
    expiring: rows.filter((item) => item.status === 'expiring').length,
    expired: rows.filter((item) => item.status === 'expired').length,
  }), [rows]);

  const resetForm = () => {
    setEditingId('');
    setScopeType('subcontractor');
    setScopeId('');
    setDocumentType('cae');
    setTitle('');
    setReference('');
    setIssuer('');
    setIssuedAt('');
    setDueAt('');
    setStatus('pending');
    setFileUrl('');
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: ComplianceDocumentSummary) => {
    setEditingId(row.id);
    setScopeType(row.scope_type);
    setScopeId(row.scope_id ?? '');
    setDocumentType(row.document_type);
    setTitle(row.title ?? '');
    setReference(row.reference ?? '');
    setIssuer(row.issuer ?? '');
    setIssuedAt(row.issued_at ?? '');
    setDueAt(row.expires_at ?? '');
    setStatus(row.status);
    setFileUrl(row.file_url ?? '');
    setOpen(true);
  };

  const submit = async () => {
    setMessage('');
    setError('');
    if (!title.trim()) {
      setError('El título del documento es obligatorio.');
      return;
    }
    if (['subcontractor', 'employee', 'driver', 'vehicle'].includes(scopeType) && !scopeId) {
      setError('Selecciona el recurso asociado al documento.');
      return;
    }
    const payload = {
      scope_type: scopeType,
      scope_id: scopeId || undefined,
      document_type: documentType,
      title: title.trim(),
      reference: reference.trim() || undefined,
      issuer: issuer.trim() || undefined,
      issued_at: issuedAt || undefined,
      expires_at: dueAt || undefined,
      status,
      file_url: fileUrl.trim() || undefined,
    };

    try {
      if (editingId) {
        await apiClient.updateComplianceDocument(editingId, payload);
        setMessage('Documento actualizado.');
      } else {
        await apiClient.createComplianceDocument(payload);
        setMessage('Documento registrado.');
      }
      setOpen(false);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar documento.');
    }
  };

  const remove = async (row: ComplianceDocumentSummary) => {
    if (!window.confirm(`Eliminar documento ${row.title}?`)) return;
    setMessage('');
    setError('');
    try {
      await apiClient.deleteComplianceDocument(row.id);
      setMessage('Documento eliminado.');
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar documento.');
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle>CAE y control documental</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="page-grid four">
            <div className="card-row"><strong>{summary.total}</strong><span className="helper">Total docs</span></div>
            <div className="card-row"><strong>{summary.valid}</strong><span className="helper">Válidos</span></div>
            <div className="card-row"><strong>{summary.expiring}</strong><span className="helper">A vencer</span></div>
            <div className="card-row"><strong>{summary.expired}</strong><span className="helper">Caducados</span></div>
          </div>
          <div className="inline-actions toolbar-spaced">
            <Button type="button" onClick={openCreate}>+ Nuevo documento</Button>
            <Input placeholder="Buscar título, referencia o emisor" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}>
              <option value="all">Ámbito: todos</option>
              <option value="company">Empresa</option>
              <option value="subcontractor">Subcontrata</option>
              <option value="employee">Empleado</option>
              <option value="driver">Conductor</option>
              <option value="vehicle">Vehículo</option>
              <option value="operation">Operación</option>
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Estado: todos</option>
              <option value="valid">Válido</option>
              <option value="expiring">A vencer</option>
              <option value="expired">Caducado</option>
              <option value="pending">Pendiente</option>
            </Select>
            <Input type="date" value={expiresBefore} onChange={(event) => setExpiresBefore(event.target.value)} />
            <Button type="button" variant="secondary" onClick={() => { void load(); }}>Aplicar</Button>
          </div>
          {message ? <div className="helper" style={{ color: 'var(--success)' }}>{message}</div> : null}
          {error ? <div className="helper" style={{ color: 'var(--danger)' }}>{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div><strong>{row.title}</strong></div>
                      <div className="helper">{row.reference ?? '-'}</div>
                    </TableCell>
                    <TableCell>{row.document_type}</TableCell>
                    <TableCell>{row.scope_type}{row.scope_id ? ` · ${scopeLabelById.get(row.scope_id) ?? row.scope_id}` : ''}</TableCell>
                    <TableCell>{row.expires_at ?? '-'}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button type="button" variant="outline" onClick={() => openEdit(row)}>Editar</Button>
                        <Button type="button" variant="destructive" onClick={() => { void remove(row); }}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>Sin documentos.</TableCell>
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
        title={editingId ? 'Editar documento' : 'Nuevo documento'}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => { void submit(); }}>{editingId ? 'Guardar cambios' : 'Registrar documento'}</Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label htmlFor="doc-scope-type">Ámbito</label>
            <Select
              id="doc-scope-type"
              value={scopeType}
              onChange={(event) => {
                setScopeType(event.target.value as ScopeType);
                setScopeId('');
              }}
            >
              <option value="company">Empresa</option>
              <option value="subcontractor">Subcontrata</option>
              <option value="employee">Empleado</option>
              <option value="driver">Conductor</option>
              <option value="vehicle">Vehículo</option>
              <option value="operation">Operación</option>
            </Select>
          </div>
          <div>
            <label htmlFor="doc-scope-id">Recurso</label>
            <Select
              id="doc-scope-id"
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
              disabled={scopeType === 'company' || scopeType === 'operation'}
            >
              <option value="">No aplica</option>
              {scopeOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="doc-type">Tipo documento</label>
            <Select id="doc-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>
              <option value="cae">CAE</option>
              <option value="insurance">Seguro</option>
              <option value="itv">ITV</option>
              <option value="contract">Contrato</option>
              <option value="training">Formación</option>
              <option value="license">Licencia</option>
              <option value="prevention">Prevención</option>
              <option value="other">Otro</option>
            </Select>
          </div>
          <div>
            <label htmlFor="doc-title">Título</label>
            <Input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Documento CAE 2026" />
          </div>
          <div>
            <label htmlFor="doc-ref">Referencia</label>
            <Input id="doc-ref" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="CAE-2026-001" />
          </div>
          <div>
            <label htmlFor="doc-issuer">Emisor</label>
            <Input id="doc-issuer" value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="Mutua / Cliente" />
          </div>
          <div>
            <label htmlFor="doc-issued">Fecha emisión</label>
            <Input id="doc-issued" type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} />
          </div>
          <div>
            <label htmlFor="doc-due">Fecha vencimiento</label>
            <Input id="doc-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>
          <div>
            <label htmlFor="doc-status">Estado</label>
            <Select id="doc-status" value={status} onChange={(event) => setStatus(event.target.value as DocStatus)}>
              <option value="pending">Pendiente</option>
              <option value="valid">Válido</option>
              <option value="expiring">A vencer</option>
              <option value="expired">Caducado</option>
            </Select>
          </div>
          <div>
            <label htmlFor="doc-file">URL archivo (opcional)</label>
            <Input id="doc-file" value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="https://..." />
          </div>
        </div>
      </Modal>
    </section>
  );
}
