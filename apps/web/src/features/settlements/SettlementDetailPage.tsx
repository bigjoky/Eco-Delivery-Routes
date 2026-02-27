import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { SettlementAdjustment, SettlementDetail, SettlementRecalculatePreview } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function SettlementDetailPage() {
  const params = useParams<{ id: string }>();
  const settlementId = params.id ?? '';
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [adjustments, setAdjustments] = useState<SettlementAdjustment[]>([]);
  const [amountCents, setAmountCents] = useState('0');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<SettlementRecalculatePreview | null>(null);

  const reload = async () => {
    if (!settlementId) return;
    const [detailData, adjustmentData] = await Promise.all([
      apiClient.getSettlementDetail(settlementId),
      apiClient.getSettlementAdjustments(settlementId),
    ]);
    setDetail(detailData);
    setAdjustments(adjustmentData);
  };

  useEffect(() => {
    reload();
  }, [settlementId]);

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

  if (!detail) {
    return (
      <section className="page-grid">
        <Card><CardContent>Cargando liquidacion...</CardContent></Card>
      </section>
    );
  }

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle liquidacion</CardTitle>
          <CardDescription>{detail.settlement.period_start} - {detail.settlement.period_end}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item"><div className="kpi-label">Estado</div><div className="kpi-value"><Badge variant="outline">{detail.settlement.status}</Badge></div></div>
            <div className="kpi-item"><div className="kpi-label">Bruto</div><div className="kpi-value">{(detail.settlement.gross_amount_cents / 100).toFixed(2)} EUR</div></div>
            <div className="kpi-item"><div className="kpi-label">Anticipos</div><div className="kpi-value">{(detail.settlement.advances_amount_cents / 100).toFixed(2)} EUR</div></div>
            <div className="kpi-item"><div className="kpi-label">Neto</div><div className="kpi-value">{(detail.settlement.net_amount_cents / 100).toFixed(2)} EUR</div></div>
          </div>

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.line_type}</TableCell>
                    <TableCell>{line.source_ref ?? '-'}</TableCell>
                    <TableCell><Badge variant={line.status === 'payable' ? 'success' : 'warning'}>{line.status}</Badge></TableCell>
                    <TableCell>{(line.line_total_cents / 100).toFixed(2)} EUR</TableCell>
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
          <CardDescription>Añade ajuste manual temporal y previsualiza antes de recalcular.</CardDescription>
        </CardHeader>
        <CardContent className="page-grid">
          <div className="form-row">
            <Input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} placeholder="Monto ajuste (centimos)" />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo ajuste temporal" />
          </div>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={onPreview}>Previsualizar</Button>
            <Button type="button" onClick={onRecalculate}>Recalcular</Button>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell>{(item.amount_cents / 100).toFixed(2)} EUR</TableCell>
                    <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
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
