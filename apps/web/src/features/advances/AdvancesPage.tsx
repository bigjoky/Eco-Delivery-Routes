import { useEffect, useState } from 'react';
import { Fragment } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AdvanceSummary, AuditLogEntry, PaginationMeta, SubcontractorSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function statusVariant(status: AdvanceSummary['status']): 'outline' | 'secondary' | 'success' | 'warning' {
  if (status === 'requested') return 'outline';
  if (status === 'approved') return 'success';
  if (status === 'deducted') return 'secondary';
  return 'warning';
}

export function AdvancesPage() {
  const [items, setItems] = useState<AdvanceSummary[]>([]);
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [subcontractorQuery, setSubcontractorQuery] = useState('');
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditMeta, setAuditMeta] = useState<PaginationMeta>({ page: 1, per_page: 20, total: 0, last_page: 0 });
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<number | null>(null);

  const [createAmount, setCreateAmount] = useState('5000');
  const [createDate, setCreateDate] = useState('2026-02-27');
  const [createReason, setCreateReason] = useState('Anticipo puntual operativa');

  const reload = (page: number) =>
    apiClient
      .getAdvances({
        status: status || undefined,
        period: period || undefined,
        subcontractorId: subcontractorId || undefined,
        page,
        perPage: meta.per_page,
      })
      .then((result) => {
        setItems(result.data);
        setMeta(result.meta);
      });

  useEffect(() => {
    apiClient.getSubcontractors({ limit: 20 }).then((rows) => {
      setSubcontractors(rows);
      if (!subcontractorId && rows.length > 0) setSubcontractorId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      apiClient.getSubcontractors({ q: subcontractorQuery, limit: 20 }).then(setSubcontractors);
    }, 250);

    return () => clearTimeout(timer);
  }, [subcontractorQuery]);

  useEffect(() => {
    reload(1);
  }, [status, period, subcontractorId]);

  const loadAudit = (page = 1) => {
    if (!selectedAdvanceId) {
      setAuditLogs([]);
      return;
    }
    apiClient
      .getAuditLogs({ resource: 'advance', id: selectedAdvanceId, page, perPage: auditMeta.per_page })
      .then((result) => {
        setAuditLogs(result.data);
        setAuditMeta(result.meta);
      });
  };

  useEffect(() => {
    loadAudit(1);
  }, [selectedAdvanceId]);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subcontractorId) return;
    await apiClient.createAdvance({
      subcontractor_id: subcontractorId,
      amount_cents: Number(createAmount),
      currency: 'EUR',
      request_date: createDate,
      reason: createReason,
    });
    await reload(1);
  };

  const onApprove = async (id: string) => {
    await apiClient.approveAdvance(id);
    await reload(meta.page);
  };

  const onExport = async () => {
    await apiClient.exportAdvancesCsv({
      subcontractorId: subcontractorId || undefined,
      status: status || undefined,
      period: period || undefined,
    });
  };

  const formatMetadata = (metadata?: Record<string, unknown> | null): string => {
    if (!metadata) return 'Sin metadata';
    return JSON.stringify(metadata, null, 2);
  };

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Anticipos</CardTitle>
          <CardDescription>Registro, aprobacion y control mensual de anticipos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="form-row">
            <Input
              value={subcontractorQuery}
              onChange={(e) => setSubcontractorQuery(e.target.value)}
              placeholder="Buscar subcontrata por nombre o CIF"
            />
            <Select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
              <option value="">todas</option>
              {subcontractors.map((item) => (
                <option key={item.id} value={item.id}>{item.legal_name}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">todos</option>
              <option value="requested">requested</option>
              <option value="approved">approved</option>
              <option value="deducted">deducted</option>
            </Select>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
          </div>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={onExport}>Exportar CSV</Button>
          </div>

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.subcontractor_name ?? item.subcontractor_id}</TableCell>
                    <TableCell>{item.request_date}</TableCell>
                    <TableCell>{(item.amount_cents / 100).toFixed(2)} {item.currency}</TableCell>
                    <TableCell><Badge variant={statusVariant(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button type="button" variant="outline" onClick={() => setSelectedAdvanceId(item.id)}>Auditoria</Button>
                        {item.status === 'requested' && <Button type="button" onClick={() => onApprove(item.id)}>Aprobar</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => reload(Math.max(1, meta.page - 1))} disabled={meta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {meta.page} / {Math.max(1, meta.last_page || 1)}</span>
            <Button type="button" variant="outline" onClick={() => reload(meta.page + 1)} disabled={meta.page >= meta.last_page}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo anticipo</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onCreate}>
            <Input value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} placeholder="Importe en centimos" />
            <Input value={createDate} onChange={(e) => setCreateDate(e.target.value)} placeholder="YYYY-MM-DD" />
            <Input value={createReason} onChange={(e) => setCreateReason(e.target.value)} placeholder="Motivo" />
            <Button type="submit" disabled={!subcontractorId}>Registrar anticipo</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria anticipo</CardTitle>
          <CardDescription>{selectedAdvanceId || 'Selecciona un anticipo para ver eventos'}</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <Fragment key={log.id}>
                    <TableRow>
                      <TableCell>{log.created_at}</TableCell>
                      <TableCell>{log.event}</TableCell>
                      <TableCell>{log.actor_name ?? log.actor_user_id ?? '-'}{log.actor_roles ? ` (${log.actor_roles})` : ''}</TableCell>
                      <TableCell>
                        <Button type="button" variant="outline" onClick={() => setExpandedAuditLogId(expandedAuditLogId === log.id ? null : log.id)}>
                          {expandedAuditLogId === log.id ? 'Ocultar detalle' : 'Ver detalle'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedAuditLogId === log.id && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <pre className="helper" style={{ whiteSpace: 'pre-wrap' }}>{formatMetadata(log.metadata)}</pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => loadAudit(Math.max(1, auditMeta.page - 1))} disabled={auditMeta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {auditMeta.page} / {Math.max(1, auditMeta.last_page || 1)}</span>
            <Button type="button" variant="outline" onClick={() => loadAudit(auditMeta.page + 1)} disabled={auditMeta.page >= auditMeta.last_page}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
