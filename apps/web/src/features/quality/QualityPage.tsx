import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { QualityRiskSummaryRow, QualitySnapshot, SubcontractorSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { severityFromScore, severityLabel } from './risk';

export function QualityPage() {
  const [items, setItems] = useState<QualitySnapshot[]>([]);
  const [scopeType, setScopeType] = useState<'all' | 'driver' | 'route' | 'subcontractor'>('all');
  const [hubId, setHubId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [threshold, setThreshold] = useState('95');
  const [underThresholdRoutes, setUnderThresholdRoutes] = useState<QualitySnapshot[]>([]);
  const [riskGroupBy, setRiskGroupBy] = useState<'hub' | 'subcontractor'>('hub');
  const [riskSummary, setRiskSummary] = useState<QualityRiskSummaryRow[]>([]);

  useEffect(() => {
    apiClient.getSubcontractors({ limit: 20 }).then(setSubcontractors);
  }, []);

  useEffect(() => {
    apiClient
      .getQualitySnapshots({
        scopeType: scopeType === 'all' ? undefined : scopeType,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then(setItems);
  }, [scopeType, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    apiClient
      .getQualityTopRoutesUnderThreshold({
        threshold: Number(threshold),
        limit: 10,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then((result) => setUnderThresholdRoutes(result.data));
  }, [threshold, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    apiClient
      .getQualityRiskSummary({
        threshold: Number(threshold),
        groupBy: riskGroupBy,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then((result) => setRiskSummary(result.data));
  }, [threshold, riskGroupBy, hubId, subcontractorId, periodStart, periodEnd]);

  const avg = useMemo(() => {
    if (items.length === 0) return 0;
    return items.reduce((acc, item) => acc + item.service_quality_score, 0) / items.length;
  }, [items]);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Calidad de Servicio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Media KPI</div>
              <div className="kpi-value">{avg.toFixed(2)}%</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Umbral</div>
              <div className="kpi-value">95%</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Snapshots</div>
              <div className="kpi-value">{items.length}</div>
            </div>
          </div>
          <div className="form-row">
            <Select value={scopeType} onChange={(e) => setScopeType(e.target.value as 'all' | 'driver' | 'route' | 'subcontractor')}>
              <option value="all">Todos los scopes</option>
              <option value="driver">Solo conductor</option>
              <option value="route">Solo ruta</option>
              <option value="subcontractor">Solo subcontrata</option>
            </Select>
            <Input value={hubId} onChange={(e) => setHubId(e.target.value)} placeholder="Filtrar hub_id (UUID)" />
            <Select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
              <option value="">Todas las subcontratas</option>
              {subcontractors.map((subcontractor) => (
                <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
              ))}
            </Select>
            <Input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="Desde periodo (YYYY-MM-DD)" />
            <Input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="Hasta periodo (YYYY-MM-DD)" />
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Umbral (ej: 95)" />
          </div>
          <div className="inline-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                apiClient.exportQualityCsv({
                  scopeType: scopeType === 'all' ? undefined : scopeType,
                  hubId: hubId || undefined,
                  subcontractorId: subcontractorId || undefined,
                  periodStart: periodStart || undefined,
                  periodEnd: periodEnd || undefined,
                })
              }
            >
              Exportar CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                apiClient.exportQualityPdf({
                  threshold: Number(threshold),
                  hubId: hubId || undefined,
                  subcontractorId: subcontractorId || undefined,
                  periodStart: periodStart || undefined,
                  periodEnd: periodEnd || undefined,
                })
              }
            >
              Exportar PDF rutas
            </Button>
          </div>

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Intentados</TableHead>
                  <TableHead>Completados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.scope_type} {item.scope_label ?? item.scope_id}</TableCell>
                    <TableCell>{item.period_start} - {item.period_end}</TableCell>
                    <TableCell>
                      <Badge variant={item.service_quality_score >= 95 ? 'success' : 'warning'}>
                        {item.service_quality_score}%
                      </Badge>
                    </TableCell>
                    <TableCell>{item.assigned_with_attempt}</TableCell>
                    <TableCell>{item.delivered_completed + item.pickups_completed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          <h3>Rutas bajo umbral</h3>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Periodo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {underThresholdRoutes.map((item) => (
                  <TableRow key={`under-${item.id}`}>
                    <TableCell>{item.scope_label ?? item.scope_id}</TableCell>
                    <TableCell>
                      <Badge variant="warning">{item.service_quality_score}%</Badge>
                    </TableCell>
                    <TableCell>{item.period_start} - {item.period_end}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          <h3>Riesgo operativo</h3>
          <div className="form-row">
            <Select value={riskGroupBy} onChange={(e) => setRiskGroupBy(e.target.value as 'hub' | 'subcontractor')}>
              <option value="hub">Agrupar por hub</option>
              <option value="subcontractor">Agrupar por subcontrata</option>
            </Select>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Rutas bajo umbral</TableHead>
                  <TableHead>Ratio</TableHead>
                  <TableHead>Media score</TableHead>
                  <TableHead>Severidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskSummary.map((item) => {
                  const severity = severityFromScore(item.avg_score);
                  return (
                    <TableRow key={`risk-${item.group_id}-${item.group_type}`}>
                      <TableCell>{item.group_label}</TableCell>
                      <TableCell>{item.routes_under_threshold}/{item.routes_count}</TableCell>
                      <TableCell>{item.under_threshold_ratio}%</TableCell>
                      <TableCell>{item.avg_score}%</TableCell>
                      <TableCell>
                        <Badge variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'warning' : 'secondary'}>
                          {severityLabel(severity)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}
