import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { HubSummary, QualityDriverBreakdown, QualityRiskSummaryRow, QualityRouteBreakdown, QualitySnapshot, SubcontractorSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { chartColorByRatio, normalizeChartWidth } from './breakdownChart';
import { severityFromScore, severityLabel } from './risk';

export function QualityPage() {
  const [items, setItems] = useState<QualitySnapshot[]>([]);
  const [scopeType, setScopeType] = useState<'all' | 'driver' | 'route' | 'subcontractor'>('all');
  const [scopeId, setScopeId] = useState('');
  const [hubId, setHubId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [threshold, setThreshold] = useState('95');
  const [underThresholdRoutes, setUnderThresholdRoutes] = useState<QualitySnapshot[]>([]);
  const [riskGroupBy, setRiskGroupBy] = useState<'hub' | 'subcontractor'>('hub');
  const [riskSummary, setRiskSummary] = useState<QualityRiskSummaryRow[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [routeBreakdown, setRouteBreakdown] = useState<QualityRouteBreakdown | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverBreakdown, setDriverBreakdown] = useState<QualityDriverBreakdown | null>(null);
  const [breakdownGranularity, setBreakdownGranularity] = useState<'week' | 'month'>('month');

  useEffect(() => {
    apiClient.getSubcontractors({ limit: 20 }).then(setSubcontractors);
    apiClient.getHubs({ onlyActive: true }).then(setHubs);
  }, []);

  useEffect(() => {
    apiClient
      .getQualitySnapshots({
        scopeType: scopeType === 'all' ? undefined : scopeType,
        scopeId: scopeId || undefined,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then(setItems);
  }, [scopeType, scopeId, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    apiClient
      .getQualityTopRoutesUnderThreshold({
        threshold: Number(threshold),
        limit: 10,
        scopeId: scopeType === 'route' ? scopeId || undefined : undefined,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then((result) => setUnderThresholdRoutes(result.data));
  }, [threshold, scopeType, scopeId, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    apiClient
      .getQualityRiskSummary({
        threshold: Number(threshold),
        groupBy: riskGroupBy,
        scopeId: scopeType === 'route' ? scopeId || undefined : undefined,
        hubId: hubId || undefined,
        subcontractorId: subcontractorId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      })
      .then((result) => setRiskSummary(result.data));
  }, [threshold, riskGroupBy, scopeType, scopeId, hubId, subcontractorId, periodStart, periodEnd]);

  useEffect(() => {
    if (!selectedRouteId) {
      setRouteBreakdown(null);
      return;
    }
    apiClient
      .getQualityRouteBreakdown(selectedRouteId, {
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        granularity: breakdownGranularity,
      })
      .then(setRouteBreakdown);
  }, [selectedRouteId, periodStart, periodEnd, breakdownGranularity]);

  useEffect(() => {
    if (!selectedDriverId) {
      setDriverBreakdown(null);
      return;
    }
    apiClient
      .getQualityDriverBreakdown(selectedDriverId, {
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        granularity: breakdownGranularity,
      })
      .then(setDriverBreakdown);
  }, [selectedDriverId, periodStart, periodEnd, breakdownGranularity]);

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
            <Input
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder={scopeType === 'route' ? 'Filtrar route_id (scope_id)' : 'Filtrar scope_id'}
            />
            <Select value={hubId} onChange={(e) => setHubId(e.target.value)}>
              <option value="">Todos los hubs</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code}</option>
              ))}
            </Select>
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
            <Select value={breakdownGranularity} onChange={(e) => setBreakdownGranularity(e.target.value as 'week' | 'month')}>
              <option value="month">Desglose mensual</option>
              <option value="week">Desglose semanal</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                apiClient.exportQualityCsv({
                  scopeType: scopeType === 'all' ? undefined : scopeType,
                  scopeId: scopeId || undefined,
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
                  scopeId: scopeType === 'route' ? scopeId || undefined : undefined,
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
                  <TableHead>Acciones</TableHead>
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
                    <TableCell>
                      {item.scope_type === 'route' ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedRouteId(item.scope_id)}
                        >
                          Ver detalle ruta
                        </Button>
                      ) : item.scope_type === 'driver' ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedDriverId(item.scope_id)}
                        >
                          Ver detalle conductor
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          {routeBreakdown && (
            <>
              <h3>Detalle KPI por ruta</h3>
              <div className="inline-actions">
                <Badge variant={routeBreakdown.service_quality_score >= 95 ? 'success' : 'warning'}>
                  {routeBreakdown.service_quality_score}%
                </Badge>
                <span>Ruta: {routeBreakdown.route_code ?? routeBreakdown.route_id}</span>
                <span>Snapshots: {routeBreakdown.snapshots_count}</span>
                <Link to={`/routes/${routeBreakdown.route_id}`}>Abrir ruta</Link>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityRouteBreakdownCsv(routeBreakdown.route_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar CSV desglose
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityRouteBreakdownPdf(routeBreakdown.route_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar PDF desglose
                </Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {routeBreakdown.periods.map((period) => (
                  <div key={period.period_key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{period.period_key}</span>
                      <span>{period.components.completion_ratio}%</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8 }}>
                      <div
                        style={{
                          width: `${normalizeChartWidth(period.components.completion_ratio)}%`,
                          height: '100%',
                          borderRadius: 6,
                          background: chartColorByRatio(period.components.completion_ratio),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Componente</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Asignados con intento</TableCell><TableCell>{routeBreakdown.components.assigned_with_attempt}</TableCell></TableRow>
                    <TableRow><TableCell>Entregas completadas</TableCell><TableCell>{routeBreakdown.components.delivered_completed}</TableCell></TableRow>
                    <TableRow><TableCell>Recogidas completadas</TableCell><TableCell>{routeBreakdown.components.pickups_completed}</TableCell></TableRow>
                    <TableRow><TableCell>Total completados</TableCell><TableCell>{routeBreakdown.components.completed_total}</TableCell></TableRow>
                    <TableRow><TableCell>Fallidas</TableCell><TableCell>{routeBreakdown.components.failed_count}</TableCell></TableRow>
                    <TableRow><TableCell>Ausencias</TableCell><TableCell>{routeBreakdown.components.absent_count}</TableCell></TableRow>
                    <TableRow><TableCell>Reintentos</TableCell><TableCell>{routeBreakdown.components.retry_count}</TableCell></TableRow>
                    <TableRow><TableCell>Ratio completitud</TableCell><TableCell>{routeBreakdown.components.completion_ratio}%</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableWrapper>
            </>
          )}

          {driverBreakdown && (
            <>
              <h3>Detalle KPI por conductor</h3>
              <div className="inline-actions">
                <Badge variant={driverBreakdown.service_quality_score >= 95 ? 'success' : 'warning'}>
                  {driverBreakdown.service_quality_score}%
                </Badge>
                <span>Conductor: {driverBreakdown.driver_code ?? driverBreakdown.driver_id}</span>
                <span>Snapshots: {driverBreakdown.snapshots_count}</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityDriverBreakdownCsv(driverBreakdown.driver_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar CSV conductor
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    apiClient.exportQualityDriverBreakdownPdf(driverBreakdown.driver_id, {
                      periodStart: periodStart || undefined,
                      periodEnd: periodEnd || undefined,
                      granularity: breakdownGranularity,
                    })
                  }
                >
                  Exportar PDF conductor
                </Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {driverBreakdown.periods.map((period) => (
                  <div key={`driver-${period.period_key}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{period.period_key}</span>
                      <span>{period.components.completion_ratio}%</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8 }}>
                      <div
                        style={{
                          width: `${normalizeChartWidth(period.components.completion_ratio)}%`,
                          height: '100%',
                          borderRadius: 6,
                          background: chartColorByRatio(period.components.completion_ratio),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Componente</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Asignados con intento</TableCell><TableCell>{driverBreakdown.components.assigned_with_attempt}</TableCell></TableRow>
                    <TableRow><TableCell>Entregas completadas</TableCell><TableCell>{driverBreakdown.components.delivered_completed}</TableCell></TableRow>
                    <TableRow><TableCell>Recogidas completadas</TableCell><TableCell>{driverBreakdown.components.pickups_completed}</TableCell></TableRow>
                    <TableRow><TableCell>Total completados</TableCell><TableCell>{driverBreakdown.components.completed_total}</TableCell></TableRow>
                    <TableRow><TableCell>Fallidas</TableCell><TableCell>{driverBreakdown.components.failed_count}</TableCell></TableRow>
                    <TableRow><TableCell>Ausencias</TableCell><TableCell>{driverBreakdown.components.absent_count}</TableCell></TableRow>
                    <TableRow><TableCell>Reintentos</TableCell><TableCell>{driverBreakdown.components.retry_count}</TableCell></TableRow>
                    <TableRow><TableCell>Ratio completitud</TableCell><TableCell>{driverBreakdown.components.completion_ratio}%</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableWrapper>
            </>
          )}

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
