import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AuditLogEntry, PaginationMeta, SettlementAdjustment, SettlementDetail } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function SettlementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [adjustments, setAdjustments] = useState<SettlementAdjustment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [amountCents, setAmountCents] = useState('-100');
  const [reason, setReason] = useState('Ajuste manual');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmountCents, setEditAmountCents] = useState('');
  const [editReason, setEditReason] = useState('');
  const [auditEventPrefix, setAuditEventPrefix] = useState('settlement.');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditMeta, setAuditMeta] = useState<PaginationMeta>({ page: 1, per_page: 20, total: 0, last_page: 0 });
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<number | null>(null);

  const loadAudit = (page = 1) => {
    if (!id) return;
    apiClient
      .getAuditLogs({
        resource: 'settlement',
        id,
        event: auditEventPrefix || undefined,
        dateFrom: auditDateFrom || undefined,
        dateTo: auditDateTo || undefined,
        page,
        perPage: auditMeta.per_page,
      })
      .then((result) => {
        setAuditLogs(result.data);
        setAuditMeta(result.meta);
      });
  };

  const load = () => {
    if (!id) return;
    apiClient.getSettlementDetail(id).then(setDetail);
    apiClient.getSettlementAdjustments(id).then(setAdjustments);
    loadAudit(1);
  };

  useEffect(() => {
    load();
  }, [id, auditEventPrefix, auditDateFrom, auditDateTo]);

  if (!id) return <section><p>Settlement ID requerido.</p></section>;
  if (!detail) return <section><p>Cargando liquidacion...</p></section>;

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiClient.createSettlementAdjustment(id, {
      amount_cents: Number(amountCents),
      reason,
    });
    load();
  };

  const onApprove = async (adjustmentId: string) => {
    await apiClient.approveSettlementAdjustment(id, adjustmentId);
    setEditingId(null);
    load();
  };

  const onReject = async (adjustmentId: string) => {
    const rejectionReason = window.prompt('Motivo del rechazo del ajuste:', 'Sin evidencia suficiente');
    if (!rejectionReason) return;
    await apiClient.rejectSettlementAdjustment(id, adjustmentId, rejectionReason);
    setEditingId(null);
    load();
  };

  const onStartEdit = (item: SettlementAdjustment) => {
    setEditingId(item.id);
    setEditAmountCents(String(item.amount_cents));
    setEditReason(item.reason);
  };

  const onSaveEdit = async (adjustmentId: string) => {
    await apiClient.updateSettlementAdjustment(id, adjustmentId, {
      amount_cents: Number(editAmountCents),
      reason: editReason,
    });
    setEditingId(null);
    load();
  };

  const onExportAudit = async () => {
    await apiClient.exportAuditLogsCsv({
      resource: 'settlement',
      id,
      event: auditEventPrefix || undefined,
      dateFrom: auditDateFrom || undefined,
      dateTo: auditDateTo || undefined,
    });
  };

  const onApproveSettlement = async () => {
    await apiClient.approveSettlement(id);
    load();
  };

  const onExportCsv = async () => {
    await apiClient.exportSettlementCsv(id);
    load();
  };

  const onExportPdf = async () => {
    await apiClient.exportSettlementPdf(id);
    load();
  };

  const onMarkPaid = async () => {
    await apiClient.markSettlementPaid(id);
    load();
  };

  const formatMetadata = (metadata?: Record<string, unknown> | null): string => {
    if (!metadata) return 'Sin metadata';
    return JSON.stringify(metadata, null, 2);
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle liquidacion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Subcontrata</div>
              <div className="kpi-value" style={{ fontSize: '16px' }}>{detail.settlement.subcontractor_name ?? detail.settlement.subcontractor_id}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Periodo</div>
              <div className="kpi-value" style={{ fontSize: '16px' }}>{detail.settlement.period_start} - {detail.settlement.period_end}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Estado</div>
              <div className="kpi-value" style={{ fontSize: '16px' }}><Badge variant="secondary">{detail.settlement.status}</Badge></div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Bruto</div>
              <div className="kpi-value">{(detail.settlement.gross_amount_cents / 100).toFixed(2)} {detail.settlement.currency}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Anticipos</div>
              <div className="kpi-value">-{(detail.settlement.advances_amount_cents / 100).toFixed(2)} {detail.settlement.currency}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Ajustes</div>
              <div className="kpi-value">{((detail.settlement.adjustments_amount_cents ?? 0) / 100).toFixed(2)} {detail.settlement.currency}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Neto</div>
              <div className="kpi-value">{(detail.settlement.net_amount_cents / 100).toFixed(2)} {detail.settlement.currency}</div>
            </div>
          </div>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={onApproveSettlement} disabled={detail.settlement.status !== 'draft'}>
              Aprobar
            </Button>
            <Button type="button" variant="outline" onClick={onExportCsv} disabled={!['approved', 'exported'].includes(detail.settlement.status)}>
              Exportar CSV
            </Button>
            <Button type="button" variant="outline" onClick={onExportPdf} disabled={!['approved', 'exported'].includes(detail.settlement.status)}>
              Exportar PDF
            </Button>
            <Button type="button" onClick={onMarkPaid} disabled={!['approved', 'exported'].includes(detail.settlement.status)}>
              Marcar pagada
            </Button>
          </div>

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Exclusion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.line_type}</TableCell>
                    <TableCell>{line.source_ref ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={line.status === 'payable' ? 'success' : 'warning'}>{line.status}</Badge>
                    </TableCell>
                    <TableCell>{(line.line_total_cents / 100).toFixed(2)} EUR</TableCell>
                    <TableCell>{line.exclusion_reason ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajustes manuales</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="form-row" onSubmit={onCreate}>
            <Input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} placeholder="Importe en centimos (+/-)" />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo del ajuste" />
            <Button type="submit">Crear ajuste</Button>
          </form>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Rechazo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} />
                      ) : (
                        item.reason
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input value={editAmountCents} onChange={(e) => setEditAmountCents(e.target.value)} />
                      ) : (
                        <>{(item.amount_cents / 100).toFixed(2)} {item.currency}</>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={item.status === 'approved' ? 'success' : 'outline'}>{item.status}</Badge></TableCell>
                    <TableCell>{item.rejection_reason ?? '-'}</TableCell>
                    <TableCell>
                      {item.status === 'pending' && (
                        <div className="inline-actions">
                          {editingId === item.id ? (
                            <>
                              <Button type="button" variant="secondary" onClick={() => onSaveEdit(item.id)}>Guardar</Button>
                              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" variant="outline" onClick={() => onStartEdit(item)}>Editar</Button>
                              <Button type="button" variant="outline" onClick={() => onApprove(item.id)}>Aprobar</Button>
                              <Button type="button" variant="destructive" onClick={() => onReject(item.id)}>Rechazar</Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="form-row">
            <Input value={auditEventPrefix} onChange={(e) => setAuditEventPrefix(e.target.value)} placeholder="Prefijo evento (ej: settlement.)" />
            <Input value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} placeholder="Desde (YYYY-MM-DD)" />
            <Input value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} placeholder="Hasta (YYYY-MM-DD)" />
          </div>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={onExportAudit}>Exportar auditoria CSV</Button>
          </div>
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setExpandedAuditLogId(expandedAuditLogId === log.id ? null : log.id)}
                        >
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
