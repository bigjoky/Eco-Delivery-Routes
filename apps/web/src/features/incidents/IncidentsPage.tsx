import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { IncidentCatalogItem, IncidentSummary, IncidentsBoardSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { useSearchParams } from 'react-router-dom';

function categoryVariant(category: IncidentSummary['category']): 'warning' | 'destructive' | 'secondary' | 'outline' {
  if (category === 'failed') return 'destructive';
  if (category === 'absent') return 'warning';
  if (category === 'retry') return 'secondary';
  return 'outline';
}

function incidentStatusHelp(resolvedAt?: string | null): string {
  return resolvedAt ? 'Incidencia resuelta y cerrada.' : 'Incidencia abierta pendiente de acción.';
}

function formatSlaTimeline(item: IncidentSummary): string {
  if (item.resolved_at) return 'Resuelta';
  if (!item.sla_due_at) return 'Sin vencimiento';
  const dueAt = new Date(item.sla_due_at);
  if (Number.isNaN(dueAt.getTime())) return 'Fecha SLA inválida';
  const now = new Date();
  const diffMinutes = Math.floor((dueAt.getTime() - now.getTime()) / 60000);
  if (diffMinutes >= 0) {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `Vence en ${hours}h ${minutes}m`;
  }
  const overdue = Math.abs(diffMinutes);
  const hours = Math.floor(overdue / 60);
  const minutes = overdue % 60;
  return `Vencida hace ${hours}h ${minutes}m`;
}

export function IncidentsPage() {
  const [items, setItems] = useState<IncidentSummary[]>([]);
  const [catalog, setCatalog] = useState<IncidentCatalogItem[]>([]);
  const [incidentableType, setIncidentableType] = useState<'shipment' | 'pickup'>('shipment');
  const [incidentableId, setIncidentableId] = useState('SHP-AGP-0001');
  const [catalogCode, setCatalogCode] = useState('');
  const [category, setCategory] = useState<'failed' | 'absent' | 'retry' | 'general'>('absent');
  const [notes, setNotes] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<'open' | 'resolved' | ''>('open');
  const [listTypeFilter, setListTypeFilter] = useState<'shipment' | 'pickup' | ''>('');
  const [listCategoryFilter, setListCategoryFilter] = useState<'failed' | 'absent' | 'retry' | 'general' | ''>('');
  const [listCatalogFilter, setListCatalogFilter] = useState('');
  const [listPriorityFilter, setListPriorityFilter] = useState<'high' | 'medium' | 'low' | ''>('');
  const [listSlaFilter, setListSlaFilter] = useState<'on_track' | 'at_risk' | 'breached' | 'resolved' | ''>('');
  const [listIncidentableId, setListIncidentableId] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [board, setBoard] = useState<IncidentsBoardSummary | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [bulkResolving, setBulkResolving] = useState(false);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [resolveError, setResolveError] = useState('');
  const [createError, setCreateError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedFromParams = useRef(false);
  const incidentsFilterStorageKey = 'eco_delivery_routes_incidents_filters';

  const incidentSummary = useMemo(() => {
    const openCount = items.filter((item) => !item.resolved_at).length;
    const resolvedCount = items.length - openCount;
    return {
      pageCount: items.length,
      open: openCount,
      resolved: resolvedCount,
    };
  }, [items]);

  const reload = () => apiClient.getIncidents({
    resolved: resolvedFilter || undefined,
    incidentableType: listTypeFilter || undefined,
    category: listCategoryFilter || undefined,
    catalogCode: listCatalogFilter || undefined,
    priority: listPriorityFilter || undefined,
    slaStatus: listSlaFilter || undefined,
    incidentableId: listIncidentableId || undefined,
    q: listSearch || undefined,
    page,
    perPage: 20,
  }).then((result) => {
      setItems(result.data);
      setLastPage(result.meta.last_page || 1);
      return apiClient.getIncidentsBoard({
        incidentableType: listTypeFilter || undefined,
        category: listCategoryFilter || undefined,
      });
    }).then((summary) => {
      setBoard(summary);
    }).catch(() => {
      setBoard(null);
    });

  useEffect(() => {
    if (!initializedFromParams.current) return;
    reload();
    apiClient.getIncidentCatalog().then((entries) => {
      setCatalog(entries);
      if (entries.length > 0) {
        setCatalogCode(entries[0].code);
        setCategory(entries[0].category);
      }
    });
  }, [resolvedFilter, page, listTypeFilter, listCategoryFilter, listCatalogFilter, listPriorityFilter, listSlaFilter, listIncidentableId, listSearch]);

  useEffect(() => {
    if (initializedFromParams.current) return;
    const resolvedParam = searchParams.get('resolved') ?? 'open';
    const typeParam = searchParams.get('type') ?? '';
    const categoryParam = searchParams.get('category') ?? '';
    const catalogParam = searchParams.get('catalog') ?? '';
    const priorityParam = searchParams.get('priority') ?? '';
    const slaParam = searchParams.get('sla') ?? '';
    const incidentableParam = searchParams.get('incidentable_id') ?? '';
    const searchParam = searchParams.get('q') ?? '';
    const pageParam = Number(searchParams.get('page') ?? '1');

    if (resolvedParam === 'open' || resolvedParam === 'resolved' || resolvedParam === '') {
      setResolvedFilter(resolvedParam as 'open' | 'resolved' | '');
    }
    if (typeParam === 'shipment' || typeParam === 'pickup') setListTypeFilter(typeParam);
    if (categoryParam) setListCategoryFilter(categoryParam as 'failed' | 'absent' | 'retry' | 'general' | '');
    if (catalogParam) setListCatalogFilter(catalogParam);
    if (priorityParam) setListPriorityFilter(priorityParam as 'high' | 'medium' | 'low' | '');
    if (slaParam) setListSlaFilter(slaParam as 'on_track' | 'at_risk' | 'breached' | 'resolved' | '');
    if (incidentableParam) setListIncidentableId(incidentableParam);
    if (searchParam) setListSearch(searchParam);
    if (!Number.isNaN(pageParam) && pageParam > 0) setPage(pageParam);

    initializedFromParams.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!initializedFromParams.current) return;
    const params = new URLSearchParams();
    if (resolvedFilter) params.set('resolved', resolvedFilter);
    if (listTypeFilter) params.set('type', listTypeFilter);
    if (listCategoryFilter) params.set('category', listCategoryFilter);
    if (listCatalogFilter) params.set('catalog', listCatalogFilter);
    if (listPriorityFilter) params.set('priority', listPriorityFilter);
    if (listSlaFilter) params.set('sla', listSlaFilter);
    if (listIncidentableId) params.set('incidentable_id', listIncidentableId);
    if (listSearch) params.set('q', listSearch);
    params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [resolvedFilter, listTypeFilter, listCategoryFilter, listCatalogFilter, listPriorityFilter, listSlaFilter, listIncidentableId, listSearch, page, setSearchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(incidentsFilterStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<{
        resolved: string;
        type: string;
        category: string;
        catalog: string;
        priority: string;
        sla: string;
        incidentableId: string;
        q: string;
      }>;
      if (parsed.resolved && !resolvedFilter) setResolvedFilter(parsed.resolved as 'open' | 'resolved' | '');
      if (parsed.type && !listTypeFilter) setListTypeFilter(parsed.type as 'shipment' | 'pickup' | '');
      if (parsed.category && !listCategoryFilter) setListCategoryFilter(parsed.category as 'failed' | 'absent' | 'retry' | 'general' | '');
      if (parsed.catalog && !listCatalogFilter) setListCatalogFilter(parsed.catalog);
      if (parsed.priority && !listPriorityFilter) setListPriorityFilter(parsed.priority as 'high' | 'medium' | 'low' | '');
      if (parsed.sla && !listSlaFilter) setListSlaFilter(parsed.sla as 'on_track' | 'at_risk' | 'breached' | 'resolved' | '');
      if (parsed.incidentableId && !listIncidentableId) setListIncidentableId(parsed.incidentableId);
      if (parsed.q && !listSearch) setListSearch(parsed.q);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      resolved: resolvedFilter,
      type: listTypeFilter,
      category: listCategoryFilter,
      catalog: listCatalogFilter,
      priority: listPriorityFilter,
      sla: listSlaFilter,
      incidentableId: listIncidentableId,
      q: listSearch,
    };
    window.localStorage.setItem(incidentsFilterStorageKey, JSON.stringify(payload));
  }, [resolvedFilter, listTypeFilter, listCategoryFilter, listCatalogFilter, listPriorityFilter, listSlaFilter, listIncidentableId, listSearch]);

  useEffect(() => {
    const visible = new Set(items.filter((item) => !item.resolved_at).map((item) => item.id));
    setSelectedIncidentIds((prev) => prev.filter((id) => visible.has(id)));
  }, [items]);

  const availableCatalog = useMemo(
    () => catalog.filter((item) => item.applies_to === incidentableType || item.applies_to === 'both'),
    [catalog, incidentableType]
  );

  const clearFilters = () => {
    setResolvedFilter('open');
    setListTypeFilter('');
    setListCategoryFilter('');
    setListCatalogFilter('');
    setListPriorityFilter('');
    setListSlaFilter('');
    setListIncidentableId('');
    setListSearch('');
    setPage(1);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (!incidentableId.trim()) {
      setCreateError('Referencia objetivo obligatoria.');
      return;
    }
    if (!catalogCode.trim()) {
      setCreateError('Selecciona un motivo de catalogo.');
      return;
    }
    try {
      await apiClient.createIncident({
        incidentable_type: incidentableType,
        incidentable_id: incidentableId,
        catalog_code: catalogCode,
        category,
        notes,
      });
      setNotes('');
      setPage(1);
      await reload();
    } catch (exception) {
      setCreateError(exception instanceof Error ? exception.message : 'No se pudo crear la incidencia');
    }
  };

  const onResolve = async (id: string) => {
    setResolvingId(id);
    setResolveError('');
    try {
      await apiClient.resolveIncident(id, 'Resuelta desde panel web');
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo resolver la incidencia');
    } finally {
      setResolvingId(null);
    }
  };

  const toggleSelectedIncident = (id: string, checked: boolean) => {
    setSelectedIncidentIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((value) => value !== id);
    });
  };

  const onResolveSelected = async () => {
    if (selectedIncidentIds.length === 0) {
      setResolveError('Selecciona al menos una incidencia abierta.');
      return;
    }
    setBulkResolving(true);
    setResolveError('');
    try {
      await apiClient.resolveIncidentsBulk(selectedIncidentIds, 'Resueltas en lote desde panel web');
      setSelectedIncidentIds([]);
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo resolver incidencias en lote');
    } finally {
      setBulkResolving(false);
    }
  };

  const onOverrideSla = async (item: IncidentSummary) => {
    const reason = window.prompt(`Motivo de ajuste SLA para ${item.id}`);
    if (!reason || reason.trim() === '') return;
    const priorityInput = window.prompt('Nueva prioridad (high/medium/low). Deja vacio para mantener.', item.priority ?? '');
    const dueInput = window.prompt('Nuevo SLA due_at ISO (opcional).', item.sla_due_at ?? '');
    try {
      await apiClient.overrideIncidentSla(item.id, {
        priority: priorityInput === 'high' || priorityInput === 'medium' || priorityInput === 'low' ? priorityInput : undefined,
        sla_due_at: dueInput && dueInput.trim() !== '' ? dueInput : undefined,
        reason: reason.trim(),
      });
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo ajustar SLA');
    }
  };

  const onEscalatePriority = async (item: IncidentSummary) => {
    const reason = window.prompt(`Motivo de escalado para ${item.id}`);
    if (!reason || reason.trim() === '') return;
    try {
      await apiClient.overrideIncidentSla(item.id, {
        priority: 'high',
        reason: reason.trim(),
      });
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo escalar prioridad');
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Registrar Incidencia</CardTitle>
          <CardDescription>Catalogo versionado de motivos para shipment y pickup.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onSubmit}>
            <div className="form-row">
              <div>
                <label>Tipo</label>
                <Select value={incidentableType} onChange={(e) => setIncidentableType(e.target.value as 'shipment' | 'pickup')}>
                  <option value="shipment">shipment</option>
                  <option value="pickup">pickup</option>
                </Select>
              </div>
              <div>
                <label>Referencia objetivo</label>
                <Input value={incidentableId} onChange={(e) => setIncidentableId(e.target.value)} placeholder="Shipment/ pickup id" />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>Catalogo</label>
                <Select
                  value={catalogCode}
                  onChange={(e) => {
                    const selected = availableCatalog.find((item) => item.code === e.target.value);
                    setCatalogCode(e.target.value);
                    if (selected) setCategory(selected.category);
                  }}
                >
                  {availableCatalog.map((item) => (
                    <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label>Categoria</label>
                <Input value={category} readOnly />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>Notas</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalle breve" />
              </div>
            </div>
            <div className="inline-actions">
              <Button type="submit">Registrar incidencia</Button>
            </div>
            {createError ? <div className="helper error">{createError}</div> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidencias recientes</CardTitle>
          <CardDescription>Filtra por estado, tipo, categoria o referencia.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">En página</div>
              <div className="kpi-value">{incidentSummary.pageCount}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Abiertas</div>
              <div className="kpi-value">{incidentSummary.open}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Resueltas</div>
              <div className="kpi-value">{incidentSummary.resolved}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Alta prioridad</div>
              <div className="kpi-value">{board?.by_priority.high ?? 0}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">SLA en riesgo</div>
              <div className="kpi-value">{board?.by_sla_status.at_risk ?? 0}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">SLA vencido</div>
              <div className="kpi-value">{board?.by_sla_status.breached ?? 0}</div>
            </div>
          </div>
          {resolveError ? <div className="helper error">{resolveError}</div> : null}
          <div className="form-row">
            <div>
              <label>Estado</label>
              <Select value={resolvedFilter} onChange={(e) => { setResolvedFilter(e.target.value as 'open' | 'resolved' | ''); setPage(1); }}>
                <option value="">todas</option>
                <option value="open">abiertas</option>
                <option value="resolved">resueltas</option>
              </Select>
            </div>
            <div>
              <label>Tipo</label>
              <Select value={listTypeFilter} onChange={(e) => { setListTypeFilter(e.target.value as 'shipment' | 'pickup' | ''); setPage(1); }}>
                <option value="">tipo</option>
                <option value="shipment">shipment</option>
                <option value="pickup">pickup</option>
              </Select>
            </div>
            <div>
              <label>Categoria</label>
              <Select value={listCategoryFilter} onChange={(e) => { setListCategoryFilter(e.target.value as 'failed' | 'absent' | 'retry' | 'general' | ''); setPage(1); }}>
                <option value="">categoria</option>
                <option value="failed">failed</option>
                <option value="absent">absent</option>
                <option value="retry">retry</option>
                <option value="general">general</option>
              </Select>
            </div>
            <div>
              <label>Catalogo</label>
              <Select value={listCatalogFilter} onChange={(e) => { setListCatalogFilter(e.target.value); setPage(1); }}>
                <option value="">catalogo</option>
                {catalog.map((item) => (
                  <option key={item.code} value={item.code}>{item.code}</option>
                ))}
              </Select>
            </div>
            <div>
              <label>Prioridad</label>
              <Select value={listPriorityFilter} onChange={(e) => { setListPriorityFilter(e.target.value as 'high' | 'medium' | 'low' | ''); setPage(1); }}>
                <option value="">prioridad</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </Select>
            </div>
            <div>
              <label>SLA</label>
              <Select value={listSlaFilter} onChange={(e) => { setListSlaFilter(e.target.value as 'on_track' | 'at_risk' | 'breached' | 'resolved' | ''); setPage(1); }}>
                <option value="">sla</option>
                <option value="on_track">on_track</option>
                <option value="at_risk">at_risk</option>
                <option value="breached">breached</option>
                <option value="resolved">resolved</option>
              </Select>
            </div>
            <div>
              <label>Referencia objetivo</label>
              <Input value={listIncidentableId} onChange={(e) => { setListIncidentableId(e.target.value); setPage(1); }} placeholder="Incidentable ID" />
            </div>
            <div>
              <label>Buscar</label>
              <Input value={listSearch} onChange={(e) => { setListSearch(e.target.value); setPage(1); }} placeholder="Buscar (id, notas, catalogo)" />
            </div>
          </div>
          <div className="inline-actions">
            <Button type="button" variant={resolvedFilter === 'open' ? 'secondary' : 'outline'} onClick={() => { setResolvedFilter('open'); setPage(1); }}>
              Abiertas
            </Button>
            <Button type="button" variant={listSlaFilter === 'breached' ? 'secondary' : 'outline'} onClick={() => { setListSlaFilter('breached'); setPage(1); }}>
              SLA vencido
            </Button>
            <Button type="button" variant={listPriorityFilter === 'high' ? 'secondary' : 'outline'} onClick={() => { setListPriorityFilter('high'); setPage(1); }}>
              Alta prioridad
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
            <Button type="button" onClick={onResolveSelected} disabled={bulkResolving || selectedIncidentIds.length === 0}>
              {bulkResolving ? 'Resolviendo selección...' : `Resolver seleccionadas (${selectedIncidentIds.length})`}
            </Button>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sel</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Ref. envio</TableHead>
                  <TableHead>Catalogo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Timeline SLA</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {!item.resolved_at ? (
                        <input
                          type="checkbox"
                          checked={selectedIncidentIds.includes(item.id)}
                          onChange={(event) => toggleSelectedIncident(item.id, event.target.checked)}
                        />
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                    <TableCell>{item.incidentable_type}</TableCell>
                    <TableCell>{item.incidentable_id}</TableCell>
                    <TableCell>{item.shipment_reference ?? '-'}</TableCell>
                    <TableCell>{item.catalog_code}</TableCell>
                    <TableCell>
                      <Badge variant={categoryVariant(item.category)} title={`Categoria: ${item.category}`}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.priority ?? '-'}</TableCell>
                    <TableCell>{item.sla_status ?? '-'}</TableCell>
                    <TableCell>{formatSlaTimeline(item)}</TableCell>
                    <TableCell title={incidentStatusHelp(item.resolved_at)}>
                      {item.resolved_at ? 'resuelta' : 'abierta'}
                    </TableCell>
                    <TableCell>
                      {item.resolved_at ? (
                        <span>-</span>
                      ) : (
                        <div className="inline-actions">
                          <Button type="button" onClick={() => onResolve(item.id)} disabled={resolvingId === item.id}>
                            {resolvingId === item.id ? 'Resolviendo...' : 'Resolver'}
                          </Button>
                          {item.priority !== 'high' ? (
                            <Button type="button" variant="outline" onClick={() => onEscalatePriority(item)}>Escalar alta</Button>
                          ) : null}
                          <Button type="button" variant="outline" onClick={() => onOverrideSla(item)}>Ajustar SLA</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11}>Sin incidencias para los filtros seleccionados.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {page} de {lastPage}</span>
            <Button type="button" onClick={() => setPage((value) => Math.min(lastPage, value + 1))} disabled={page >= lastPage}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
