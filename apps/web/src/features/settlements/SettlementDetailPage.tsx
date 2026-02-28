import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AuditLogEntry, SettlementAdjustment, SettlementBulkReconcilePreview, SettlementDetail, SettlementRecalculatePreview, SettlementReconciliationReason } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { hasValidCatalogReason, normalizeBulkReconcileFilters } from './reconciliation';
import { apiClient } from '../../services/apiClient';

export function SettlementDetailPage() {
  const params = useParams<{ id: string }>();
  const settlementId = params.id ?? '';
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [adjustments, setAdjustments] = useState<SettlementAdjustment[]>([]);
  const [amountCents, setAmountCents] = useState('0');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<SettlementRecalculatePreview | null>(null);
  const [newAdjustmentAmount, setNewAdjustmentAmount] = useState('0');
  const [newAdjustmentReason, setNewAdjustmentReason] = useState('');
  const [roles, setRoles] = useState<string[]>(sessionStore.getRoles());
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditEventFilter, setAuditEventFilter] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reconciliationReasons, setReconciliationReasons] = useState<SettlementReconciliationReason[]>([]);
  const [selectedExclusionCode, setSelectedExclusionCode] = useState('');
  const [bulkLineType, setBulkLineType] = useState<'all' | 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment'>('all');
  const [bulkCurrentStatus, setBulkCurrentStatus] = useState<'all' | 'payable' | 'excluded'>('payable');
  const [bulkTargetStatus, setBulkTargetStatus] = useState<'payable' | 'excluded'>('excluded');
  const [bulkRouteId, setBulkRouteId] = useState('');
  const [bulkSubcontractorId, setBulkSubcontractorId] = useState('');
  const [bulkPreview, setBulkPreview] = useState<SettlementBulkReconcilePreview | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const reload = async () => {
    if (!settlementId) return;
    const [detailData, adjustmentData] = await Promise.all([
      apiClient.getSettlementDetail(settlementId),
      apiClient.getSettlementAdjustments(settlementId),
    ]);
    setDetail(detailData);
    setAdjustments(adjustmentData);
  };

  const loadAudit = async () => {
    if (!settlementId) return;
    const response = await apiClient.getAuditLogs({
      resource: 'settlement',
      id: settlementId,
      event: auditEventFilter.trim() || undefined,
      page: 1,
      perPage: 10,
    });
    setAuditRows(response.data);
  };

  useEffect(() => {
    apiClient.getCurrentUser().finally(() => setRoles(sessionStore.getRoles()));
    apiClient.getSettlementReconciliationReasons().then((rows) => {
      setReconciliationReasons(rows);
      if (rows.length > 0) {
        setSelectedExclusionCode(rows[0].code);
      }
    });
  }, []);

  useEffect(() => {
    reload();
  }, [settlementId]);

  useEffect(() => {
    loadAudit();
  }, [settlementId, auditEventFilter]);

  const onPreview = async () => {
    if (!settlementId) return;
    const amount = Number(amountCents || '0');
    const manualAdjustments = reason.trim().length > 0 ? [{ amount_cents: amount, reason }] : [];
    const result = await apiClient.previewSettlementRecalculate(settlementId, { manual_adjustments: manualAdjustments });
    setPreview(result);
  };

  const onRecalculate = async () => {
    if (!settlementId) return;
    await apiClient.recalculateSettlement(settlementId);
    await reload();
    setPreview(null);
  };

  const onCreateAdjustment = async () => {
    if (!settlementId) return;
    await apiClient.createSettlementAdjustment(settlementId, {
      amount_cents: Number(newAdjustmentAmount || '0'),
      reason: newAdjustmentReason,
    });
    setFeedback('Ajuste creado');
    setNewAdjustmentAmount('0');
    setNewAdjustmentReason('');
    await reload();
    await loadAudit();
  };

  const onApproveAdjustment = async (adjustmentId: string) => {
    if (!settlementId) return;
    await apiClient.approveSettlementAdjustment(settlementId, adjustmentId);
    setFeedback(`Ajuste ${adjustmentId} aprobado`);
    await reload();
    await loadAudit();
  };

  const onRejectAdjustment = async (adjustmentId: string) => {
    if (!settlementId) return;
    const rejectReason = (rejectReasons[adjustmentId] ?? '').trim();
    if (!rejectReason) {
      setFeedback('Indica un motivo de rechazo para el ajuste.');
      return;
    }
    await apiClient.rejectSettlementAdjustment(settlementId, adjustmentId, rejectReason);
    setFeedback(`Ajuste ${adjustmentId} rechazado`);
    setRejectReasons((prev) => {
      const next = { ...prev };
      delete next[adjustmentId];
      return next;
    });
    await reload();
    await loadAudit();
  };

  const onExportCsv = async () => {
    if (!settlementId) return;
    await apiClient.exportSettlementCsv(settlementId);
    setFeedback('Export CSV lanzado');
    await loadAudit();
  };

  const onExportPdf = async () => {
    if (!settlementId) return;
    await apiClient.exportSettlementPdf(settlementId);
    setFeedback('Export PDF lanzado');
    await loadAudit();
  };

  const onExcludeLine = async (lineId: string) => {
    if (!settlementId) return;
    if (!selectedExclusionCode) {
      setFeedback('Selecciona un motivo de exclusion del catalogo.');
      return;
    }
    await apiClient.reconcileSettlementLine(settlementId, lineId, {
      status: 'excluded',
      exclusion_code: selectedExclusionCode,
    });
    setFeedback(`Linea ${lineId} excluida`);
    await reload();
    await loadAudit();
  };

  const onRestoreLine = async (lineId: string) => {
    if (!settlementId) return;
    await apiClient.reconcileSettlementLine(settlementId, lineId, { status: 'payable' });
    setFeedback(`Linea ${lineId} marcada pagable`);
    await reload();
    await loadAudit();
  };

  const onBulkReconcile = async () => {
    if (!settlementId) return;
    if (!hasValidCatalogReason(bulkTargetStatus, selectedExclusionCode)) {
      setFeedback('Selecciona un motivo de exclusion para la conciliacion masiva.');
      return;
    }
    const normalized = normalizeBulkReconcileFilters({
      lineType: bulkLineType,
      currentStatus: bulkCurrentStatus,
    });
    const result = await apiClient.reconcileSettlementLinesBulk(settlementId, {
      status: bulkTargetStatus,
      exclusion_code: bulkTargetStatus === 'excluded' ? selectedExclusionCode : undefined,
      line_type: normalized.line_type,
      current_status: normalized.current_status,
      route_id: bulkRouteId.trim() || undefined,
      subcontractor_id: bulkSubcontractorId.trim() || undefined,
    });
    setFeedback(`Conciliacion masiva aplicada: ${result.affected_count} lineas.`);
    setBulkPreview(null);
    await reload();
    await loadAudit();
  };

  const onPreviewBulkReconcile = async () => {
    if (!settlementId) return;
    if (!hasValidCatalogReason(bulkTargetStatus, selectedExclusionCode)) {
      setFeedback('Selecciona un motivo de exclusion para previsualizar conciliacion masiva.');
      return;
    }
    const normalized = normalizeBulkReconcileFilters({
      lineType: bulkLineType,
      currentStatus: bulkCurrentStatus,
    });
    const previewData = await apiClient.previewReconcileSettlementLinesBulk(settlementId, {
      status: bulkTargetStatus,
      exclusion_code: bulkTargetStatus === 'excluded' ? selectedExclusionCode : undefined,
      line_type: normalized.line_type,
      current_status: normalized.current_status,
      route_id: bulkRouteId.trim() || undefined,
      subcontractor_id: bulkSubcontractorId.trim() || undefined,
    });
    setBulkPreview(previewData);
    setFeedback(`Preview masivo calculado: ${previewData.affected_count} lineas potenciales.`);
  };

  if (!detail) {
    return (
      <section className="page-grid">
        <Card><CardContent>Cargando liquidacion...</CardContent></Card>
      </section>
    );
  }

  const settlementStatus = detail.settlement.status;
  const isDraft = settlementStatus === 'draft';
  const canManageAdjustments = roles.includes('accountant') || roles.includes('super_admin');
  const canApproveAdjustments = roles.includes('operations_manager') || roles.includes('super_admin');
  const canRecalculate = roles.includes('accountant') || roles.includes('super_admin');
  const canExport = roles.includes('accountant') || roles.includes('super_admin');
  const canReconcileLines = roles.includes('accountant') || roles.includes('super_admin');
  const canExportByStatus = settlementStatus === 'approved' || settlementStatus === 'exported';

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle liquidacion</CardTitle>
          <CardDescription>{detail.settlement.period_start} - {detail.settlement.period_end}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="helper">
            Roles activos: {roles.length > 0 ? roles.join(', ') : 'sin roles cargados'}
          </div>
          {feedback && <div className="helper">{feedback}</div>}
          <div className="kpi-grid">
            <div className="kpi-item"><div className="kpi-label">Estado</div><div className="kpi-value"><Badge variant="outline">{detail.settlement.status}</Badge></div></div>
            <div className="kpi-item"><div className="kpi-label">Bruto</div><div className="kpi-value">{(detail.settlement.gross_amount_cents / 100).toFixed(2)} EUR</div></div>
            <div className="kpi-item"><div className="kpi-label">Anticipos</div><div className="kpi-value">{(detail.settlement.advances_amount_cents / 100).toFixed(2)} EUR</div></div>
            <div className="kpi-item"><div className="kpi-label">Neto</div><div className="kpi-value">{(detail.settlement.net_amount_cents / 100).toFixed(2)} EUR</div></div>
          </div>

          <div className="form-row">
            <Select value={selectedExclusionCode} onChange={(e) => setSelectedExclusionCode(e.target.value)}>
              <option value="">Motivo de exclusion...</option>
              {reconciliationReasons.map((reasonItem) => (
                <option key={reasonItem.id} value={reasonItem.code}>
                  {reasonItem.code} - {reasonItem.name}
                </option>
              ))}
            </Select>
            <Select value={bulkLineType} onChange={(e) => setBulkLineType(e.target.value as typeof bulkLineType)}>
              <option value="all">Tipo linea (todas)</option>
              <option value="shipment_delivery">shipment_delivery</option>
              <option value="pickup_normal">pickup_normal</option>
              <option value="pickup_return">pickup_return</option>
              <option value="manual_adjustment">manual_adjustment</option>
            </Select>
            <Select value={bulkCurrentStatus} onChange={(e) => setBulkCurrentStatus(e.target.value as typeof bulkCurrentStatus)}>
              <option value="all">Estado actual (todos)</option>
              <option value="payable">payable</option>
              <option value="excluded">excluded</option>
            </Select>
            <Select value={bulkTargetStatus} onChange={(e) => setBulkTargetStatus(e.target.value as typeof bulkTargetStatus)}>
              <option value="excluded">Objetivo: excluded</option>
              <option value="payable">Objetivo: payable</option>
            </Select>
          </div>
          <div className="form-row">
            <Input value={bulkRouteId} onChange={(e) => setBulkRouteId(e.target.value)} placeholder="Filtro route_id (uuid, opcional)" />
            <Input value={bulkSubcontractorId} onChange={(e) => setBulkSubcontractorId(e.target.value)} placeholder="Filtro subcontractor_id (uuid, opcional)" />
          </div>
          <div className="inline-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onPreviewBulkReconcile}
              disabled={!canReconcileLines || !isDraft}
            >
              Preview lote
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBulkReconcile}
              disabled={!canReconcileLines || !isDraft}
            >
              Conciliar en lote
            </Button>
          </div>
          {bulkPreview && (
            <div className="kpi-grid">
              <div className="kpi-item"><div className="kpi-label">Lineas afectadas</div><div className="kpi-value">{bulkPreview.affected_count}</div></div>
              <div className="kpi-item"><div className="kpi-label">Neto actual</div><div className="kpi-value">{(bulkPreview.before_totals.net_amount_cents / 100).toFixed(2)} EUR</div></div>
              <div className="kpi-item"><div className="kpi-label">Neto post-conciliacion</div><div className="kpi-value">{(bulkPreview.after_totals.net_amount_cents / 100).toFixed(2)} EUR</div></div>
              <div className="kpi-item"><div className="kpi-label">Delta neto</div><div className="kpi-value">{((bulkPreview.after_totals.net_amount_cents - bulkPreview.before_totals.net_amount_cents) / 100).toFixed(2)} EUR</div></div>
            </div>
          )}

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.line_type}</TableCell>
                    <TableCell>{line.source_ref ?? '-'}</TableCell>
                    <TableCell><Badge variant={line.status === 'payable' ? 'success' : 'warning'}>{line.status}</Badge></TableCell>
                    <TableCell>{(line.line_total_cents / 100).toFixed(2)} EUR</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onExcludeLine(line.id)}
                          disabled={!canReconcileLines || !isDraft || line.line_type === 'advance_deduction' || line.status === 'excluded'}
                        >
                          Excluir
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onRestoreLine(line.id)}
                          disabled={!canReconcileLines || !isDraft || line.line_type === 'advance_deduction' || line.status === 'payable'}
                        >
                          Reincluir
                        </Button>
                      </div>
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
          <CardTitle>Previsualizar recálculo</CardTitle>
          <CardDescription>Workflow draft: ajustes, previsualización, recálculo y exportes.</CardDescription>
        </CardHeader>
        <CardContent className="page-grid">
          <div className="kpi-grid">
            <div className="kpi-item"><div className="kpi-label">Recalcular</div><div className="kpi-value">{canRecalculate && isDraft ? 'Habilitado' : 'Bloqueado'}</div></div>
            <div className="kpi-item"><div className="kpi-label">Gestionar ajustes</div><div className="kpi-value">{canManageAdjustments && isDraft ? 'Habilitado' : 'Bloqueado'}</div></div>
            <div className="kpi-item"><div className="kpi-label">Aprobar/Rechazar</div><div className="kpi-value">{canApproveAdjustments && isDraft ? 'Habilitado' : 'Bloqueado'}</div></div>
            <div className="kpi-item"><div className="kpi-label">Exportar</div><div className="kpi-value">{canExport && canExportByStatus ? 'Habilitado' : 'Bloqueado'}</div></div>
          </div>

          <div className="form-row">
            <Input value={newAdjustmentAmount} onChange={(e) => setNewAdjustmentAmount(e.target.value)} placeholder="Nuevo ajuste (centimos)" />
            <Input value={newAdjustmentReason} onChange={(e) => setNewAdjustmentReason(e.target.value)} placeholder="Motivo nuevo ajuste" />
          </div>
          <Button
            type="button"
            onClick={onCreateAdjustment}
            disabled={!canManageAdjustments || !isDraft || newAdjustmentReason.trim().length === 0}
          >
            Crear ajuste
          </Button>

          <div className="form-row">
            <Input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} placeholder="Monto ajuste (centimos)" />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo ajuste temporal" />
          </div>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={onPreview} disabled={!canRecalculate || !isDraft}>Previsualizar</Button>
            <Button type="button" onClick={onRecalculate} disabled={!canRecalculate || !isDraft}>Recalcular</Button>
            <Button type="button" variant="outline" onClick={onExportCsv} disabled={!canExport || !canExportByStatus}>Exportar CSV</Button>
            <Button type="button" variant="outline" onClick={onExportPdf} disabled={!canExport || !canExportByStatus}>Exportar PDF</Button>
          </div>

          {preview && (
            <div className="kpi-grid">
              <div className="kpi-item"><div className="kpi-label">Bruto</div><div className="kpi-value">{(preview.totals.gross_amount_cents / 100).toFixed(2)} EUR</div></div>
              <div className="kpi-item"><div className="kpi-label">Anticipos</div><div className="kpi-value">{(preview.totals.advances_amount_cents / 100).toFixed(2)} EUR</div></div>
              <div className="kpi-item"><div className="kpi-label">Ajustes</div><div className="kpi-value">{(preview.totals.adjustments_amount_cents / 100).toFixed(2)} EUR</div></div>
              <div className="kpi-item"><div className="kpi-label">Neto (preview)</div><div className="kpi-value">{(preview.totals.net_amount_cents / 100).toFixed(2)} EUR</div></div>
            </div>
          )}

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell>{(item.amount_cents / 100).toFixed(2)} EUR</TableCell>
                    <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Input
                          value={rejectReasons[item.id] ?? ''}
                          onChange={(event) => setRejectReasons((prev) => ({ ...prev, [item.id]: event.target.value }))}
                          placeholder="Motivo rechazo"
                          disabled={!canApproveAdjustments || !isDraft || item.status !== 'pending'}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onApproveAdjustment(item.id)}
                          disabled={!canApproveAdjustments || !isDraft || item.status !== 'pending'}
                        >
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onRejectAdjustment(item.id)}
                          disabled={!canApproveAdjustments || !isDraft || item.status !== 'pending'}
                        >
                          Rechazar
                        </Button>
                      </div>
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
          <CardTitle>Timeline auditoria</CardTitle>
          <CardDescription>Eventos de liquidacion y ajustes del periodo.</CardDescription>
        </CardHeader>
        <CardContent className="page-grid">
          <div className="form-row">
            <Input
              value={auditEventFilter}
              onChange={(e) => setAuditEventFilter(e.target.value)}
              placeholder="Filtrar por evento (ej: settlement.adjustment.approved)"
            />
            <Button type="button" variant="outline" onClick={loadAudit}>Refrescar</Button>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>Sin eventos para este filtro.</TableCell>
                  </TableRow>
                )}
                {auditRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.actor_name ?? row.actor_user_id ?? 'sistema'}</TableCell>
                    <TableCell>
                      {row.metadata ? JSON.stringify(row.metadata) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}
