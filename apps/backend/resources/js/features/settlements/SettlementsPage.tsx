import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ExportActionsModal } from '../../components/common/ExportActionsModal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { HubSummary, PaginationMeta, SettlementPreview, SettlementReconciliationSummaryRow, SettlementReconciliationTrendRow, SettlementSummary, SubcontractorSummary } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { hasExportAccess } from '../../core/auth/exportAccess';
import { apiClient } from '../../services/apiClient';

function statusVariant(status: SettlementSummary['status']): 'outline' | 'secondary' | 'success' {
  if (status === 'draft') return 'outline';
  if (status === 'approved' || status === 'exported') return 'secondary';
  return 'success';
}

export function SettlementsPage() {
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [trendGranularity, setTrendGranularity] = useState<'week' | 'month'>('month');
  const [hubId, setHubId] = useState('');
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [subcontractorId, setSubcontractorId] = useState('');
  const [subcontractorQuery, setSubcontractorQuery] = useState('');
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [items, setItems] = useState<SettlementSummary[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<SettlementReconciliationSummaryRow[]>([]);
  const [reconciliationTrends, setReconciliationTrends] = useState<SettlementReconciliationTrendRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [advanceAmountEur, setAdvanceAmountEur] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceMessage, setAdvanceMessage] = useState('');
  const canExport = hasExportAccess('settlements', sessionStore.getRoles());

  useEffect(() => {
    apiClient.getSubcontractors({ limit: 20 }).then(setSubcontractors);
    apiClient.getHubs({ onlyActive: true }).then(setHubs);
    Promise.all([
      apiClient.getSettlements({ page: 1, perPage: 10 }),
      apiClient.getSettlementReconciliationSummary({}),
      apiClient.getSettlementReconciliationTrends({ granularity: 'month', limit: 12 }),
    ]).then(([settlementsResult, summaryResult, trendsResult]) => {
      setItems(settlementsResult.data);
      setMeta(settlementsResult.meta);
      setReconciliationSummary(summaryResult);
      setReconciliationTrends(trendsResult);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      apiClient.getSubcontractors({ q: subcontractorQuery, limit: 20 }).then(setSubcontractors);
    }, 250);

    return () => clearTimeout(timer);
  }, [subcontractorQuery]);

  const search = async (page: number) => {
    const [result, summary, trends] = await Promise.all([
      apiClient.getSettlements({
        status: status || undefined,
        period: period || undefined,
        subcontractorId: subcontractorId || undefined,
        page,
        perPage: meta.per_page,
      }),
      apiClient.getSettlementReconciliationSummary({
        hubId: hubId || undefined,
        period: period || undefined,
        subcontractorId: subcontractorId || undefined,
      }),
      apiClient.getSettlementReconciliationTrends({
        granularity: trendGranularity,
        limit: 12,
        hubId: hubId || undefined,
        period: period || undefined,
        subcontractorId: subcontractorId || undefined,
      }),
    ]);
    setItems(result.data);
    setMeta(result.meta);
    setReconciliationSummary(summary);
    setReconciliationTrends(trends);
  };

  const onSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await search(1);
  };

  const runPreview = async () => {
    setPreviewError('');
    setAdvanceMessage('');
    if (!subcontractorId || !period) {
      setPreviewError('Selecciona subcontrata y periodo (YYYY-MM) para previsualizar.');
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await apiClient.getSettlementPreview({ subcontractorId, period });
      setPreview(data);
    } catch (exception) {
      setPreview(null);
      setPreviewError(exception instanceof Error ? exception.message : 'No se pudo cargar la previsualizacion');
    } finally {
      setPreviewLoading(false);
    }
  };

  const createAdvance = async () => {
    setPreviewError('');
    setAdvanceMessage('');
    if (!subcontractorId) {
      setPreviewError('Selecciona subcontrata para registrar anticipo.');
      return;
    }
    const amount = Math.round(Number(advanceAmountEur) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPreviewError('Importe de anticipo invalido.');
      return;
    }
    try {
      await apiClient.createAdvance({
        subcontractor_id: subcontractorId,
        amount_cents: amount,
        currency: 'EUR',
        request_date: new Date().toISOString().slice(0, 10),
        reason: advanceReason || 'Anticipo operativo',
      });
      setAdvanceAmountEur('');
      setAdvanceReason('');
      setAdvanceMessage('Anticipo registrado correctamente.');
    } catch (exception) {
      setPreviewError(exception instanceof Error ? exception.message : 'No se pudo registrar el anticipo');
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Liquidaciones</CardTitle>
          <CardDescription>Filtro por estado, periodo y subcontrata.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onSearch}>
            <div className="form-row">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">todos</option>
                <option value="draft">draft</option>
                <option value="approved">approved</option>
                <option value="exported">exported</option>
                <option value="paid">paid</option>
              </Select>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
            </div>
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
            </div>
            <div className="form-row">
              <Select value={hubId} onChange={(e) => setHubId(e.target.value)}>
                <option value="">todos los hubs</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
                ))}
              </Select>
              <Select value={trendGranularity} onChange={(e) => setTrendGranularity(e.target.value as 'week' | 'month')}>
                <option value="month">Tendencia mensual</option>
                <option value="week">Tendencia semanal</option>
              </Select>
            </div>
            <Button type="submit">Buscar</Button>
          </form>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={runPreview} disabled={previewLoading}>
              {previewLoading ? 'Previsualizando...' : 'Previsualizar liquidacion'}
            </Button>
            <Input
              type="number"
              step="0.01"
              value={advanceAmountEur}
              onChange={(e) => setAdvanceAmountEur(e.target.value)}
              placeholder="Anticipo EUR"
            />
            <Input
              value={advanceReason}
              onChange={(e) => setAdvanceReason(e.target.value)}
              placeholder="Motivo anticipo"
            />
            <Button type="button" variant="outline" onClick={createAdvance}>
              Registrar anticipo
            </Button>
          </div>
          {previewError ? <div className="helper error">{previewError}</div> : null}
          {advanceMessage ? <div className="helper">{advanceMessage}</div> : null}
          {preview ? (
            <div className="kpi-grid">
              <div className="kpi-item">
                <div className="kpi-label">Preview bruto</div>
                <div className="kpi-value">{(preview.totals.gross_amount_cents / 100).toFixed(2)} EUR</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">Preview anticipos</div>
                <div className="kpi-value">{(preview.totals.advances_amount_cents / 100).toFixed(2)} EUR</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">Preview neto</div>
                <div className="kpi-value">{(preview.totals.net_amount_cents / 100).toFixed(2)} EUR</div>
              </div>
            </div>
          ) : null}

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Neto</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.subcontractor_name ?? item.subcontractor_id}</TableCell>
                    <TableCell>{item.period_start} - {item.period_end}</TableCell>
                    <TableCell><Badge variant={statusVariant(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>{(item.net_amount_cents / 100).toFixed(2)} {item.currency}</TableCell>
                    <TableCell>
                      <Link to={`/settlements/${item.id}`} className="helper">detalle</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => search(Math.max(1, meta.page - 1))} disabled={meta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {meta.page} / {Math.max(1, meta.last_page || 1)}</span>
            <Button type="button" variant="outline" onClick={() => search(meta.page + 1)} disabled={meta.page >= meta.last_page}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen exclusiones por motivo</CardTitle>
          <CardDescription>Reporting contable de lineas excluidas agrupadas por `exclusion_code`.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <ExportActionsModal
              title="Exportar resumen de exclusiones"
              triggerDisabled={!canExport}
              actions={[
                {
                  id: 'settlements-summary-csv',
                  label: 'CSV resumen',
                  run: () => apiClient.exportSettlementReconciliationSummaryCsv({
                    period: period || undefined,
                    subcontractorId: subcontractorId || undefined,
                    hubId: hubId || undefined,
                  }),
                },
                {
                  id: 'settlements-summary-pdf',
                  label: 'PDF resumen',
                  run: () => apiClient.exportSettlementReconciliationSummaryPdf({
                    period: period || undefined,
                    subcontractorId: subcontractorId || undefined,
                    hubId: hubId || undefined,
                  }),
                },
              ]}
            />
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Lineas</TableHead>
                  <TableHead>Importe excluido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliationSummary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>Sin datos para filtros actuales.</TableCell>
                  </TableRow>
                )}
                {reconciliationSummary.map((row) => (
                  <TableRow key={row.exclusion_code}>
                    <TableCell>{row.exclusion_code}</TableCell>
                    <TableCell>{row.lines_count}</TableCell>
                    <TableCell>{(row.excluded_amount_cents / 100).toFixed(2)} EUR</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tendencias exclusiones</CardTitle>
          <CardDescription>Evolucion por periodo y motivo (`{trendGranularity}`).</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Lineas</TableHead>
                  <TableHead>Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliationTrends.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>Sin tendencias para filtros actuales.</TableCell>
                  </TableRow>
                )}
                {reconciliationTrends.map((row) => (
                  <TableRow key={`${row.period_bucket}-${row.exclusion_code}`}>
                    <TableCell>{row.period_bucket}</TableCell>
                    <TableCell>{row.exclusion_code}</TableCell>
                    <TableCell>{row.lines_count}</TableCell>
                    <TableCell>{(row.excluded_amount_cents / 100).toFixed(2)} EUR</TableCell>
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
