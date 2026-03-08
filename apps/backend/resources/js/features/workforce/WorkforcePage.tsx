import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { SubcontractorSummary, WorkforceEmployeeSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function WorkforcePage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<WorkforceEmployeeSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'own' | 'external' | 'contractor'>('all');
  const [subFilter, setSubFilter] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [code, setCode] = useState('');
  const [employmentType, setEmploymentType] = useState<'own' | 'external' | 'contractor'>('own');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended'>('active');

  const load = async (overrides?: {
    query?: string;
    statusFilter?: 'all' | 'active' | 'inactive' | 'suspended';
    typeFilter?: 'all' | 'own' | 'external' | 'contractor';
    subFilter?: string;
  }) => {
    setError('');
    const effectiveQuery = overrides?.query ?? query;
    const effectiveStatusFilter = overrides?.statusFilter ?? statusFilter;
    const effectiveTypeFilter = overrides?.typeFilter ?? typeFilter;
    const effectiveSubFilter = overrides?.subFilter ?? subFilter;
    try {
      const [workforceRows, subcontractorRows] = await Promise.all([
        apiClient.getWorkforce({
          q: effectiveQuery || undefined,
          status: effectiveStatusFilter === 'all' ? undefined : effectiveStatusFilter,
          employmentType: effectiveTypeFilter === 'all' ? undefined : effectiveTypeFilter,
          subcontractorId: effectiveSubFilter || undefined,
        }),
        apiClient.getSubcontractors({ limit: 100 }),
      ]);
      setRows(workforceRows);
      setSubcontractors(subcontractorRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar personal.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const id = searchParams.get('id') ?? '';
    const subcontractorIdParam = searchParams.get('subcontractor_id') ?? '';
    const q = searchParams.get('q') ?? '';
    const nextQuery = q || id || '';
    const nextSubFilter = subcontractorIdParam || '';
    const nextTypeFilter: 'all' | 'own' | 'external' | 'contractor' = subcontractorIdParam ? 'contractor' : typeFilter;
    if (nextQuery) setQuery(nextQuery);
    if (subcontractorIdParam) {
      setSubFilter(subcontractorIdParam);
      setTypeFilter('contractor');
    }
    void load({
      query: nextQuery || undefined,
      subFilter: nextSubFilter || undefined,
      typeFilter: nextTypeFilter,
    });
  }, [searchParams]);

  const summary = useMemo(() => ({
    total: rows.length,
    own: rows.filter((item) => item.employment_type === 'own').length,
    external: rows.filter((item) => item.employment_type === 'external').length,
    contractor: rows.filter((item) => item.employment_type === 'contractor').length,
    active: rows.filter((item) => item.status === 'active').length,
  }), [rows]);

  const resetForm = () => {
    setEditingId('');
    setName('');
    setDocumentId('');
    setCode('');
    setEmploymentType('own');
    setSubcontractorId('');
    setRoleTitle('');
    setPhone('');
    setEmail('');
    setStatus('active');
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: WorkforceEmployeeSummary) => {
    setEditingId(row.id);
    setName(row.name ?? '');
    setDocumentId(row.document_id ?? '');
    setCode(row.code ?? '');
    setEmploymentType(row.employment_type);
    setSubcontractorId(row.subcontractor_id ?? '');
    setRoleTitle(row.role_title ?? '');
    setPhone(row.phone ?? '');
    setEmail(row.email ?? '');
    setStatus(row.status);
    setOpen(true);
  };

  const submit = async () => {
    setMessage('');
    setError('');
    if (!name.trim() || !documentId.trim()) {
      setError('Nombre y documento son obligatorios.');
      return;
    }
    if (employmentType === 'contractor' && !subcontractorId) {
      setError('Selecciona subcontrata para personal de contrata.');
      return;
    }

    const payload = {
      code: code.trim() || undefined,
      name: name.trim(),
      document_id: documentId.trim(),
      employment_type: employmentType,
      subcontractor_id: employmentType === 'contractor' ? subcontractorId : undefined,
      role_title: roleTitle.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      status,
    };

    try {
      if (editingId) {
        await apiClient.updateWorkforce(editingId, payload);
        setMessage('Empleado actualizado.');
      } else {
        await apiClient.createWorkforce(payload);
        setMessage('Empleado creado.');
      }
      setOpen(false);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar empleado.');
    }
  };

  const remove = async (row: WorkforceEmployeeSummary) => {
    if (!window.confirm(`Eliminar ${row.name}?`)) return;
    setMessage('');
    setError('');
    try {
      await apiClient.deleteWorkforce(row.id);
      setMessage('Empleado eliminado.');
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar empleado.');
    }
  };

  return (
    <section className="page-grid">
      <div className="inline-actions">
        <Link to="/dashboard" className="helper">Dashboard</Link>
        <span className="helper">/</span>
        <span className="helper">Personal</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personal propio, externo y contratas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="page-grid four">
            <div className="card-row"><strong>{summary.total}</strong><span className="helper">Total</span></div>
            <div className="card-row"><strong>{summary.own}</strong><span className="helper">Propio</span></div>
            <div className="card-row"><strong>{summary.contractor}</strong><span className="helper">Contrata</span></div>
            <div className="card-row"><strong>{summary.active}</strong><span className="helper">Activos</span></div>
          </div>
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <Button type="button" onClick={openCreate}>+ Crear empleado</Button>
            <Button type="button" variant="outline" onClick={() => { void load(); }}>Actualizar</Button>
            <Input placeholder="Buscar por nombre, doc o código" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Estado: todos</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="suspended">Suspendido</option>
            </Select>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <option value="all">Tipo: todos</option>
              <option value="own">Propio</option>
              <option value="external">Externo</option>
              <option value="contractor">Contrata</option>
            </Select>
            <Select value={subFilter} onChange={(event) => setSubFilter(event.target.value)}>
              <option value="">Subcontrata: todas</option>
              {subcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.legal_name}</option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={() => { void load(); }}>Aplicar filtros</Button>
          </div>
          {message ? <div className="helper" style={{ color: 'var(--success)' }}>{message}</div> : null}
          {error ? <div className="helper" style={{ color: 'var(--danger)' }}>{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de personal</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div><strong>{row.name}</strong></div>
                      <div className="helper">{row.code ?? '-'}</div>
                    </TableCell>
                    <TableCell>{row.document_id}</TableCell>
                    <TableCell>{row.employment_type}</TableCell>
                    <TableCell>{row.subcontractor_name ?? '-'}</TableCell>
                    <TableCell>{row.role_title ?? '-'}</TableCell>
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
                    <TableCell colSpan={7}>Sin resultados.</TableCell>
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
        title={editingId ? 'Editar empleado' : 'Crear empleado'}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => { void submit(); }}>{editingId ? 'Guardar cambios' : 'Crear empleado'}</Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label htmlFor="wf-name">Nombre</label>
            <Input id="wf-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre completo" />
          </div>
          <div>
            <label htmlFor="wf-document">Documento</label>
            <Input id="wf-document" value={documentId} onChange={(event) => setDocumentId(event.target.value)} placeholder="DNI / NIE / CIF" />
          </div>
          <div>
            <label htmlFor="wf-code">Código interno</label>
            <Input id="wf-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="EMP-0001" />
          </div>
          <div>
            <label htmlFor="wf-type">Tipo</label>
            <Select id="wf-type" value={employmentType} onChange={(event) => setEmploymentType(event.target.value as typeof employmentType)}>
              <option value="own">Propio</option>
              <option value="external">Externo</option>
              <option value="contractor">Contrata</option>
            </Select>
          </div>
          <div>
            <label htmlFor="wf-sub">Subcontrata</label>
            <Select id="wf-sub" value={subcontractorId} onChange={(event) => setSubcontractorId(event.target.value)} disabled={employmentType !== 'contractor'}>
              <option value="">Sin subcontrata</option>
              {subcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.legal_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="wf-role">Rol puesto</label>
            <Input id="wf-role" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="Conductor, almacén..." />
          </div>
          <div>
            <label htmlFor="wf-phone">Teléfono</label>
            <Input id="wf-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="600123456" />
          </div>
          <div>
            <label htmlFor="wf-email">Email</label>
            <Input id="wf-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@dominio.com" />
          </div>
          <div>
            <label htmlFor="wf-status">Estado</label>
            <Select id="wf-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="suspended">Suspendido</option>
            </Select>
          </div>
        </div>
      </Modal>
    </section>
  );
}
