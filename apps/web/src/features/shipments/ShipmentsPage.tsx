import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { HubSummary, PaginationMeta, ShipmentSummary } from '../../core/api/types';
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
  const [query, setQuery] = useState('');
  const [scheduledFrom, setScheduledFrom] = useState('');
  const [scheduledTo, setScheduledTo] = useState('');
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [createHubId, setCreateHubId] = useState('');
  const [createReference, setCreateReference] = useState('');
  const [createConsignee, setCreateConsignee] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createScheduledAt, setCreateScheduledAt] = useState('');
  const [createError, setCreateError] = useState('');
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
  const [importing, setImporting] = useState(false);

  const reload = (page: number, nextStatus: string = status) =>
    apiClient.getShipments({
      page,
      perPage: meta.per_page,
      status: nextStatus || undefined,
      q: query || undefined,
      scheduledFrom: scheduledFrom || undefined,
      scheduledTo: scheduledTo || undefined,
    }).then((result) => {
      setItems(result.data);
      setMeta(result.meta);
    });

  useEffect(() => {
    reload(1);
  }, [status, query, scheduledFrom, scheduledTo]);

  useEffect(() => {
    apiClient.getHubs({ onlyActive: true }).then((rows) => {
      setHubs(rows);
      if (!createHubId && rows.length > 0) setCreateHubId(rows[0].id);
    }).catch(() => setHubs([]));
  }, []);

  const createShipment = async () => {
    if (!createHubId || !createReference) {
      setCreateError('Hub y referencia son obligatorios.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await apiClient.createShipment({
        hub_id: createHubId,
        reference: createReference,
        consignee_name: createConsignee || null,
        address_line: createAddress || null,
        scheduled_at: createScheduledAt || null,
      });
      setCreateReference('');
      setCreateConsignee('');
      setCreateAddress('');
      setCreateScheduledAt('');
      await reload(1);
    } catch (exception) {
      setCreateError(exception instanceof Error ? exception.message : 'No se pudo crear el envio');
    } finally {
      setCreating(false);
    }
  };

  const exportCsv = async () => {
    setExportError('');
    try {
      await apiClient.exportShipmentsCsv({
        status: status || undefined,
        q: query || undefined,
        scheduledFrom: scheduledFrom || undefined,
        scheduledTo: scheduledTo || undefined,
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
        columns: exportColumns,
      });
    } catch (exception) {
      setExportError(exception instanceof Error ? exception.message : 'No se pudo exportar PDF');
    }
  };

  const toggleExportColumn = (column: string) => {
    setExportColumns((current) => (
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column]
    ));
  };

  const runImport = async () => {
    if (!importFile) {
      setImportError('Selecciona un CSV para importar.');
      return;
    }
    setImportError('');
    setImportResult(null);
    setImporting(true);
    try {
      const result = await apiClient.importShipmentsCsv(importFile, { dryRun: importDryRun });
      setImportResult(result);
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
            <label htmlFor="create-shipment-ref">Referencia</label>
            <input
              id="create-shipment-ref"
              value={createReference}
              onChange={(event) => setCreateReference(event.target.value)}
              placeholder="SHP-AGP-0001"
            />
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
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Direccion</TableHead>
                  <TableHead>Programado</TableHead>
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
            <Button type="button" variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button type="button" variant="outline" onClick={exportPdf}>
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
              />
              Dry run
            </label>
            <Button type="button" onClick={runImport} disabled={importing}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </div>
          {importError ? <div className="helper">{importError}</div> : null}
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
    </section>
  );
}
