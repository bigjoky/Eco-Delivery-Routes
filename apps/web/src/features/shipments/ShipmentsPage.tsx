import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AuditLogEntry, HubSummary, PaginationMeta, ShipmentImportJob, ShipmentSummary } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { apiClient } from '../../services/apiClient';

function shipmentVariant(status: string): 'default' | 'secondary' | 'warning' | 'success' {
  if (status === 'delivered') return 'success';
  if (status === 'out_for_delivery') return 'secondary';
  if (status === 'incident') return 'warning';
  return 'default';
}

export function ShipmentsPage() {
  const [items, setItems] = useState<ShipmentSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [status, setStatus] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'scheduled_at' | 'reference' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [scheduledFrom, setScheduledFrom] = useState('');
  const [scheduledTo, setScheduledTo] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedFromParams = useRef(false);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [createHubId, setCreateHubId] = useState('');
  const [createReference, setCreateReference] = useState('');
  const [createConsignee, setCreateConsignee] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createScheduledAt, setCreateScheduledAt] = useState('');
  const [createError, setCreateError] = useState('');
  const [createFieldErrors, setCreateFieldErrors] = useState<{ hub?: string; reference?: string; scheduledAt?: string }>({});
  const [creating, setCreating] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportColumns, setExportColumns] = useState<string[]>([
    'reference',
    'status',
    'consignee_name',
    'address_line',
    'scheduled_at',
    'delivered_at',
    'hub_id',
  ]);
  const [importSummary, setImportSummary] = useState<null | Record<string, number>>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDryRun, setImportDryRun] = useState(true);
  const [importResult, setImportResult] = useState<null | {
    dry_run: boolean;
    created_count: number;
    skipped_count: number;
    error_count: number;
    rows: Array<{ row: number; reference?: string; status: string; errors?: string[] }>;
  }>(null);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [importAsync, setImportAsync] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importJob, setImportJob] = useState<ShipmentImportJob | null>(null);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [roles, setRoles] = useState(sessionStore.getRoles());
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const isMock = !apiBase || apiBase === 'undefined' || apiBase === 'null';
  const canExport = isMock || roles.some((role) => (
    role === 'super_admin' || role === 'operations_manager' || role === 'traffic_operator' || role === 'accountant'
  ));
  const canImport = isMock || roles.some((role) => (
    role === 'super_admin' || role === 'operations_manager' || role === 'traffic_operator'
  ));

  const reload = (page: number, nextStatus: string = status) =>
    apiClient.getShipments({
      page,
      perPage,
      status: nextStatus || undefined,
      hubId: hubFilter || undefined,
      q: query || undefined,
      scheduledFrom: scheduledFrom || undefined,
      scheduledTo: scheduledTo || undefined,
      sort: sortField,
      dir: sortDir,
    }).then((result) => {
      setItems(result.data);
      setMeta(result.meta);
    });

  useEffect(() => {
    if (!initializedFromParams.current) return;
    reload(1);
  }, [status, hubFilter, query, scheduledFrom, scheduledTo, sortField, sortDir, perPage]);

  useEffect(() => {
    if (initializedFromParams.current) return;
    const statusParam = searchParams.get('status') ?? '';
    const hubParam = searchParams.get('hub_id') ?? '';
    const qParam = searchParams.get('q') ?? '';
    const scheduledFromParam = searchParams.get('scheduled_from') ?? '';
    const scheduledToParam = searchParams.get('scheduled_to') ?? '';
    const sortParam = searchParams.get('sort') as 'created_at' | 'scheduled_at' | 'reference' | 'status' | null;
    const dirParam = searchParams.get('dir') as 'asc' | 'desc' | null;
    const perPageParam = Number(searchParams.get('per_page') ?? '');

    if (statusParam) setStatus(statusParam);
    if (hubParam) setHubFilter(hubParam);
    if (qParam) setQuery(qParam);
    if (scheduledFromParam) setScheduledFrom(scheduledFromParam);
    if (scheduledToParam) setScheduledTo(scheduledToParam);
    if (sortParam && ['created_at', 'scheduled_at', 'reference', 'status'].includes(sortParam)) setSortField(sortParam);
    if (dirParam && (dirParam === 'asc' || dirParam === 'desc')) setSortDir(dirParam);
    if (!Number.isNaN(perPageParam) && perPageParam > 0) setPerPage(perPageParam);

    initializedFromParams.current = true;
    const pageParam = Number(searchParams.get('page') ?? '1');
    const initialPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    reload(initialPage);
  }, [searchParams]);

  useEffect(() => {
    if (!initializedFromParams.current) return;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (hubFilter) params.set('hub_id', hubFilter);
    if (query) params.set('q', query);
    if (scheduledFrom) params.set('scheduled_from', scheduledFrom);
    if (scheduledTo) params.set('scheduled_to', scheduledTo);
    if (sortField) params.set('sort', sortField);
    if (sortDir) params.set('dir', sortDir);
    if (perPage) params.set('per_page', String(perPage));
    if (meta.page) params.set('page', String(meta.page));
    setSearchParams(params, { replace: true });
  }, [status, hubFilter, query, scheduledFrom, scheduledTo, sortField, sortDir, perPage, meta.page, setSearchParams]);

  useEffect(() => {
    return sessionStore.subscribe(() => {
      setRoles(sessionStore.getRoles());
    });
  }, []);

  useEffect(() => {
    if (!canImport || !importJobId) return;
    let active = true;
    const poll = async () => {
      try {
        const job = await apiClient.getShipmentImportStatus(importJobId);
        if (!active) return;
        setImportJob(job);
        if (job.status === 'completed' || job.status === 'failed') {
          return;
        }
        setTimeout(poll, 5000);
      } catch {
        if (!active) return;
        setTimeout(poll, 8000);
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [canImport, importJobId]);

  useEffect(() => {
    if (!canImport) return;
    setAuditLoading(true);
    apiClient
      .getAuditLogs({ event: 'shipments.', page: 1, perPage: 20 })
      .then((result) => setAuditRows(result.data))
      .catch(() => setAuditRows([]))
      .finally(() => setAuditLoading(false));
  }, [canImport]);

  useEffect(() => {
    apiClient.getHubs({ onlyActive: true }).then((rows) => {
      setHubs(rows);
      if (!createHubId && rows.length > 0) setCreateHubId(rows[0].id);
    }).catch(() => setHubs([]));
  }, []);

  const createShipment = async () => {
    const nextErrors: { hub?: string; reference?: string; scheduledAt?: string } = {};
    const reference = createReference.trim();
    const referencePattern = /^SHP-[A-Z]{3}-\d{4}$/;
    if (!createHubId) nextErrors.hub = 'Selecciona un hub.';
    if (!reference) nextErrors.reference = 'La referencia es obligatoria.';
    if (reference && reference.length < 5) nextErrors.reference = 'La referencia debe tener al menos 5 caracteres.';
    if (reference && !referencePattern.test(reference)) {
      nextErrors.reference = 'Formato esperado: SHP-XXX-0000';
    }
    if (createScheduledAt) {
      const parsed = Date.parse(createScheduledAt);
      if (Number.isNaN(parsed)) nextErrors.scheduledAt = 'Fecha/hora no valida (usa ISO).';
    }
    setCreateFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCreateError('Revisa los campos marcados antes de crear el envio.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await apiClient.createShipment({
        hub_id: createHubId,
        reference,
        consignee_name: createConsignee || null,
        address_line: createAddress || null,
        scheduled_at: createScheduledAt || null,
      });
      setCreateReference('');
      setCreateConsignee('');
      setCreateAddress('');
      setCreateScheduledAt('');
      setCreateFieldErrors({});
      await reload(1);
    } catch (exception) {
      setCreateError(exception instanceof Error ? exception.message : 'No se pudo crear el envio');
    } finally {
      setCreating(false);
    }
  };

  const setQuickRange = (range: 'today' | 'tomorrow' | 'next7' | 'clear') => {
    if (range === 'clear') {
      setScheduledFrom('');
      setScheduledTo('');
      return;
    }
    const today = new Date();
    const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
    if (range === 'today') {
      const day = toIsoDate(today);
      setScheduledFrom(day);
      setScheduledTo(day);
      return;
    }
    if (range === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const day = toIsoDate(tomorrow);
      setScheduledFrom(day);
      setScheduledTo(day);
      return;
    }
    const start = toIsoDate(today);
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    setScheduledFrom(start);
    setScheduledTo(toIsoDate(end));
  };

  const exportCsv = async () => {
    setExportError('');
    try {
      await apiClient.exportShipmentsCsv({
        status: status || undefined,
        q: query || undefined,
        scheduledFrom: scheduledFrom || undefined,
        scheduledTo: scheduledTo || undefined,
        sort: sortField,
        dir: sortDir,
        hubId: hubFilter || undefined,
        columns: exportColumns,
      });
    } catch (exception) {
      setExportError(exception instanceof Error ? exception.message : 'No se pudo exportar CSV');
    }
  };

  const exportPdf = async () => {
    setExportError('');
    try {
      await apiClient.exportShipmentsPdf({
        status: status || undefined,
        q: query || undefined,
        scheduledFrom: scheduledFrom || undefined,
        scheduledTo: scheduledTo || undefined,
        sort: sortField,
        dir: sortDir,
        hubId: hubFilter || undefined,
        columns: exportColumns,
      });
    } catch (exception) {
      setExportError(exception instanceof Error ? exception.message : 'No se pudo exportar PDF');
    }
  };

  const setSort = (field: 'created_at' | 'scheduled_at' | 'reference' | 'status') => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: 'created_at' | 'scheduled_at' | 'reference' | 'status') => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const toggleExportColumn = (column: string) => {
    setExportColumns((current) => (
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column]
    ));
  };

  const summarizeImportErrors = (rows: Array<{ status: string; errors?: string[] }>) => {
    const summary: Record<string, number> = {};
    rows.forEach((row) => {
      if (row.status !== 'error' || !row.errors?.length) return;
      row.errors.forEach((error) => {
        summary[error] = (summary[error] ?? 0) + 1;
      });
    });
    return summary;
  };

  const downloadImportTemplate = async () => {
    try {
      await apiClient.downloadShipmentsTemplate();
    } catch {
      const header = 'hub_code,reference,consignee_name,address_line,scheduled_at,service_type';
      const sample = 'AGP-HUB-01,SHP-AGP-0009,Cliente Demo,Calle Larios 12,2026-03-05T08:30:00Z,delivery';
      const content = `${header}\n${sample}\n`;
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'shipments_import_template.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const runImport = async () => {
    if (!importFile) {
      setImportError('Selecciona un CSV para importar.');
      return;
    }
    setImportError('');
    setImportMessage('');
    setImportResult(null);
    setImportSummary(null);
    setImportJobId(null);
    setImportJob(null);
    setImporting(true);
    try {
      const result = await apiClient.importShipmentsCsv(importFile, { dryRun: importDryRun, async: importAsync });
      if ('job_dispatched' in result) {
        setImportJobId(result.import_id);
        setImportMessage(`Importacion en cola: ${result.import_id}`);
      } else {
        setImportResult(result);
        setImportSummary(summarizeImportErrors(result.rows));
        if (result.import_id) {
          setImportJobId(result.import_id);
        }
      }
    } catch (exception) {
      setImportError(exception instanceof Error ? exception.message : 'No se pudo importar');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Crear Envio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <label htmlFor="create-shipment-hub">Hub</label>
            <select id="create-shipment-hub" value={createHubId} onChange={(event) => setCreateHubId(event.target.value)}>
              <option value="">Selecciona hub</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
              ))}
            </select>
            {createFieldErrors.hub ? <div className="helper">{createFieldErrors.hub}</div> : null}
            <label htmlFor="create-shipment-ref">Referencia</label>
            <input
              id="create-shipment-ref"
              value={createReference}
              onChange={(event) => setCreateReference(event.target.value)}
              placeholder="SHP-AGP-0001"
            />
            {createFieldErrors.reference ? <div className="helper">{createFieldErrors.reference}</div> : null}
            <label htmlFor="create-shipment-consignee">Destinatario</label>
            <input
              id="create-shipment-consignee"
              value={createConsignee}
              onChange={(event) => setCreateConsignee(event.target.value)}
              placeholder="Nombre cliente"
            />
          </div>
          <div className="inline-actions">
            <label htmlFor="create-shipment-address">Direccion</label>
            <input
              id="create-shipment-address"
              value={createAddress}
              onChange={(event) => setCreateAddress(event.target.value)}
              placeholder="Calle, numero"
            />
            <label htmlFor="create-shipment-scheduled">Programado</label>
            <input
              id="create-shipment-scheduled"
              type="datetime-local"
              value={createScheduledAt}
              onChange={(event) => setCreateScheduledAt(event.target.value)}
            />
            {createFieldErrors.scheduledAt ? <div className="helper">{createFieldErrors.scheduledAt}</div> : null}
            <Button type="button" onClick={createShipment} disabled={creating}>
              {creating ? 'Creando...' : 'Crear envio'}
            </Button>
          </div>
          {createError ? <div className="helper">{createError}</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Envios</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" className="btn btn-outline" onClick={() => setSort('reference')}>
                      Referencia {sortIndicator('reference')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="btn btn-outline" onClick={() => setSort('status')}>
                      Estado {sortIndicator('status')}
                    </button>
                  </TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Direccion</TableHead>
                  <TableHead>
                    <button type="button" className="btn btn-outline" onClick={() => setSort('scheduled_at')}>
                      Programado {sortIndicator('scheduled_at')}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><Link to={`/shipments/${item.id}`}>{item.reference}</Link></TableCell>
                    <TableCell><Badge variant={shipmentVariant(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>{item.consignee_name ?? '-'}</TableCell>
                    <TableCell>{item.address_line ?? '-'}</TableCell>
                    <TableCell>{item.scheduled_at ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <label htmlFor="shipment-query">Buscar</label>
            <input
              id="shipment-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Referencia, ID o destinatario"
            />
            <div className="inline-actions">
              <span className="helper">Estados rapidos</span>
              <Button type="button" variant={status === '' ? 'secondary' : 'outline'} onClick={() => setStatus('')}>Todos</Button>
              <Button type="button" variant={status === 'created' ? 'secondary' : 'outline'} onClick={() => setStatus('created')}>Created</Button>
              <Button type="button" variant={status === 'out_for_delivery' ? 'secondary' : 'outline'} onClick={() => setStatus('out_for_delivery')}>Out</Button>
              <Button type="button" variant={status === 'delivered' ? 'secondary' : 'outline'} onClick={() => setStatus('delivered')}>Delivered</Button>
              <Button type="button" variant={status === 'incident' ? 'secondary' : 'outline'} onClick={() => setStatus('incident')}>Incident</Button>
            </div>
            <label htmlFor="shipment-status">Estado</label>
            <select
              id="shipment-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="created">created</option>
              <option value="out_for_delivery">out_for_delivery</option>
              <option value="delivered">delivered</option>
              <option value="incident">incident</option>
            </select>
            <label htmlFor="shipment-hub">Hub</label>
            <select
              id="shipment-hub"
              value={hubFilter}
              onChange={(event) => setHubFilter(event.target.value)}
            >
              <option value="">Todos</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
              ))}
            </select>
            <label htmlFor="shipment-date-from">Desde</label>
            <input
              id="shipment-date-from"
              type="date"
              value={scheduledFrom}
              onChange={(event) => setScheduledFrom(event.target.value)}
            />
            <label htmlFor="shipment-date-to">Hasta</label>
            <input
              id="shipment-date-to"
              type="date"
              value={scheduledTo}
              onChange={(event) => setScheduledTo(event.target.value)}
            />
            <div className="inline-actions">
              <span className="helper">Rangos rapidos</span>
              <Button type="button" variant="outline" onClick={() => setQuickRange('today')}>Hoy</Button>
              <Button type="button" variant="outline" onClick={() => setQuickRange('tomorrow')}>Manana</Button>
              <Button type="button" variant="outline" onClick={() => setQuickRange('next7')}>Prox 7 dias</Button>
              <Button type="button" variant="outline" onClick={() => setQuickRange('clear')}>Limpiar</Button>
            </div>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={!canExport}>
              Export CSV
            </Button>
            <Button type="button" variant="outline" onClick={exportPdf} disabled={!canExport}>
              Export PDF
            </Button>
          </div>
          <div className="inline-actions">
            <span className="helper">Columnas export</span>
            {['reference', 'status', 'consignee_name', 'address_line', 'scheduled_at', 'delivered_at', 'hub_id'].map((column) => (
              <label key={column}>
                <input
                  type="checkbox"
                  checked={exportColumns.includes(column)}
                  onChange={() => toggleExportColumn(column)}
                  disabled={!canExport}
                />
                {column}
              </label>
            ))}
          </div>
          {exportError ? <div className="helper">{exportError}</div> : null}
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => reload(Math.max(1, meta.page - 1))} disabled={meta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {meta.page} / {Math.max(1, meta.last_page || 1)}</span>
            <label htmlFor="shipments-per-page">Por pagina</label>
            <select
              id="shipments-per-page"
              value={perPage}
              onChange={(event) => setPerPage(Number(event.target.value))}
            >
              {[10, 25, 50].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => reload(meta.page + 1)}
              disabled={meta.page >= meta.last_page}
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
      {canImport ? (
        <Card>
          <CardHeader>
            <CardTitle className="page-title">Importar CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-actions">
              <input
                type="file"
                accept=".csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
            <label>
              <input
                type="checkbox"
                checked={importDryRun}
                onChange={(event) => setImportDryRun(event.target.checked)}
                disabled={importAsync}
              />
              Dry run
            </label>
            <label>
              <input
                type="checkbox"
                checked={importAsync}
                onChange={(event) => {
                  const next = event.target.checked;
                  setImportAsync(next);
                  if (next) setImportDryRun(false);
                }}
              />
              Async
            </label>
            <Button type="button" onClick={runImport} disabled={importing}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void downloadImportTemplate()}>
              Descargar plantilla
            </Button>
            </div>
          {importError ? <div className="helper">{importError}</div> : null}
          {importMessage ? <div className="helper">{importMessage}</div> : null}
          {importJob ? (
            <div className="kpi-grid">
              <div>
                <div className="helper">Import ID</div>
                <div>{importJob.id}</div>
              </div>
              <div>
                <div className="helper">Estado</div>
                <div>{importJob.status}</div>
              </div>
              <div>
                <div className="helper">Creados</div>
                <div>{importJob.created_count}</div>
              </div>
              <div>
                <div className="helper">Errores</div>
                <div>{importJob.error_count}</div>
              </div>
              {importJob.error_message ? (
                <div>
                  <div className="helper">Error</div>
                  <div>{importJob.error_message}</div>
                </div>
              ) : null}
            </div>
          ) : null}
          {importResult ? (
            <div className="kpi-grid">
              <div>
                <div className="helper">Dry run</div>
                  <div>{importResult.dry_run ? 'si' : 'no'}</div>
                </div>
                <div>
                  <div className="helper">Creados</div>
                  <div>{importResult.created_count}</div>
                </div>
                <div>
                  <div className="helper">Errores</div>
                  <div>{importResult.error_count}</div>
                </div>
              {importSummary ? Object.entries(importSummary).map(([reason, count]) => (
                <div key={reason}>
                  <div className="helper">{reason}</div>
                  <div>{count}</div>
                </div>
              )) : null}
            </div>
          ) : null}
          {importResult?.rows?.length ? (
            <TableWrapper>
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Errores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.rows.map((row) => (
                      <TableRow key={`${row.row}-${row.reference ?? ''}`}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell>{row.reference ?? '-'}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.errors?.join(', ') ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </TableWrapper>
          ) : null}
        </CardContent>
      </Card>
    ) : null}
      {canImport ? (
        <Card>
          <CardHeader>
            <CardTitle className="page-title">Auditoria envios</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLoading ? <div className="helper">Cargando...</div> : null}
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.length ? auditRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.created_at}</TableCell>
                      <TableCell>{row.event}</TableCell>
                      <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                      <TableCell>{typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata ?? {})}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4}>Sin eventos</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
