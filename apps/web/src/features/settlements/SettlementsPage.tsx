import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { PaginationMeta, SettlementReconciliationSummaryRow, SettlementSummary, SubcontractorSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function statusVariant(status: SettlementSummary['status']): 'outline' | 'secondary' | 'success' {
  if (status === 'draft') return 'outline';
  if (status === 'approved' || status === 'exported') return 'secondary';
  return 'success';
}

export function SettlementsPage() {
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [hubId, setHubId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [subcontractorQuery, setSubcontractorQuery] = useState('');
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [items, setItems] = useState<SettlementSummary[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<SettlementReconciliationSummaryRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });

  useEffect(() => {
    apiClient.getSubcontractors({ limit: 20 }).then(setSubcontractors);
    Promise.all([
      apiClient.getSettlements({ page: 1, perPage: 10 }),
      apiClient.getSettlementReconciliationSummary({}),
    ]).then(([settlementsResult, summaryResult]) => {
      setItems(settlementsResult.data);
      setMeta(settlementsResult.meta);
      setReconciliationSummary(summaryResult);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      apiClient.getSubcontractors({ q: subcontractorQuery, limit: 20 }).then(setSubcontractors);
    }, 250);

    return () => clearTimeout(timer);
  }, [subcontractorQuery]);

  const search = async (page: number) => {
    const [result, summary] = await Promise.all([
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
    ]);
    setItems(result.data);
    setMeta(result.meta);
    setReconciliationSummary(summary);
  };

  const onSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await search(1);
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
              <Input value={hubId} onChange={(e) => setHubId(e.target.value)} placeholder="Hub ID (uuid, opcional)" />
            </div>
            <Button type="submit">Buscar</Button>
          </form>

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
            <Button
              type="button"
              variant="outline"
              onClick={() => apiClient.exportSettlementReconciliationSummaryCsv({
                period: period || undefined,
                subcontractorId: subcontractorId || undefined,
                hubId: hubId || undefined,
              })}
            >
              Exportar CSV resumen
            </Button>
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
    </section>
  );
}
