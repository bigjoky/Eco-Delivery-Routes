import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { ExportActionsModal } from '../../components/common/ExportActionsModal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { SettlementPreview, SubcontractorSummary } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { hasExportAccess } from '../../core/auth/exportAccess';
import { apiClient } from '../../services/apiClient';

export function SettlementPreviewPage() {
  const [subcontractorId, setSubcontractorId] = useState('');
  const [subcontractorQuery, setSubcontractorQuery] = useState('');
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [period, setPeriod] = useState('2026-02');
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [finalizedId, setFinalizedId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [paid, setPaid] = useState(false);
  const canExport = hasExportAccess('settlements', sessionStore.getRoles());

  useEffect(() => {
    apiClient.getSubcontractors({ limit: 20 }).then((items) => {
      setSubcontractors(items);
      if (!subcontractorId && items.length > 0) {
        setSubcontractorId(items[0].id);
      }
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      apiClient.getSubcontractors({ q: subcontractorQuery, limit: 20 }).then(setSubcontractors);
    }, 250);

    return () => clearTimeout(timer);
  }, [subcontractorQuery]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subcontractorId) return;
    const result = await apiClient.getSettlementPreview({ subcontractorId, period });
    setPreview(result);
    setFinalizedId(null);
    setApproved(false);
    setPaid(false);
  };

  const onFinalize = async () => {
    if (!subcontractorId) return;
    const result = await apiClient.finalizeSettlement({ subcontractorId, period });
    setFinalizedId(result.id);
    setApproved(false);
    setPaid(false);
  };

  const onApprove = async () => {
    if (!finalizedId) return;
    await apiClient.approveSettlement(finalizedId);
    setApproved(true);
  };

  const onExportCsv = async () => {
    if (!finalizedId) return;
    await apiClient.exportSettlementCsv(finalizedId);
  };

  const onMarkPaid = async () => {
    if (!finalizedId) return;
    await apiClient.markSettlementPaid(finalizedId);
    setPaid(true);
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Pre-liquidacion Mensual</CardTitle>
          <CardDescription>Calculo previo y workflow de aprobacion/pago.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onSubmit}>
            <div className="form-row">
              <Input
                value={subcontractorQuery}
                onChange={(e) => setSubcontractorQuery(e.target.value)}
                placeholder="Buscar subcontrata por nombre o CIF"
              />
              <Select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
                <option value="">Selecciona subcontrata</option>
                {subcontractors.map((item) => (
                  <option key={item.id} value={item.id}>{item.legal_name}</option>
                ))}
              </Select>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
            </div>
            <Button type="submit" disabled={!subcontractorId}>Calcular preview</Button>
          </form>

          {preview && (
            <>
              <div className="kpi-grid">
                <div className="kpi-item">
                  <div className="kpi-label">Subcontrata</div>
                  <div className="kpi-value" style={{ fontSize: '16px' }}>{preview.subcontractor.legal_name}</div>
                </div>
                <div className="kpi-item">
                  <div className="kpi-label">Bruto</div>
                  <div className="kpi-value">{(preview.totals.gross_amount_cents / 100).toFixed(2)} EUR</div>
                </div>
                <div className="kpi-item">
                  <div className="kpi-label">Anticipos</div>
                  <div className="kpi-value">{(preview.totals.advances_amount_cents / 100).toFixed(2)} EUR</div>
                </div>
                <div className="kpi-item">
                  <div className="kpi-label">Neto</div>
                  <div className="kpi-value">{(preview.totals.net_amount_cents / 100).toFixed(2)} EUR</div>
                </div>
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
                    {preview.lines.map((line, idx) => (
                      <TableRow key={`${line.line_type}-${idx}`}>
                        <TableCell>{line.line_type}</TableCell>
                        <TableCell>{line.source_ref ?? '-'}</TableCell>
                        <TableCell><Badge variant={line.status === 'payable' ? 'success' : 'warning'}>{line.status}</Badge></TableCell>
                        <TableCell>{(line.line_total_cents / 100).toFixed(2)} EUR</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </>
          )}
        </CardContent>
        {preview && (
          <CardFooter>
            <Button type="button" onClick={onFinalize}>Finalizar</Button>
            {finalizedId && !approved && <Button type="button" variant="secondary" onClick={onApprove}>Aprobar</Button>}
            {finalizedId && approved && !paid && (
              <ExportActionsModal
                title="Exportar pre-liquidación"
                triggerDisabled={!canExport}
                actions={[{ id: 'settlement-preview-csv', label: 'CSV', run: () => onExportCsv() }]}
              />
            )}
            {finalizedId && approved && !paid && <Button type="button" variant="secondary" onClick={onMarkPaid}>Marcar pagada</Button>}
            {finalizedId && <Badge variant="outline">ID: {finalizedId}</Badge>}
            {approved && <Badge variant="secondary">Aprobada</Badge>}
            {paid && <Badge variant="success">Pagada</Badge>}
          </CardFooter>
        )}
      </Card>
    </section>
  );
}
