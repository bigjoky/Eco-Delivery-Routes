import { useEffect, useMemo, useRef, useState } from 'react';
import { EntityActivityTimeline } from '../../components/audit/EntityActivityTimeline';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { IncidentCatalogItem, IncidentSlaRecommendationAction, IncidentSummary, IncidentsBoardSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { Link, useSearchParams } from 'react-router-dom';
import {
  IncidentBulkReasonCode,
  composeIncidentBulkResolveNotes,
  validateIncidentBulkResolve,
} from './incidentsBulkValidation';

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

function getIncidentEntityHref(item: IncidentSummary): string | null {
  if (item.incidentable_type === 'shipment') {
    return `/shipments/${item.incidentable_id}`;
  }
  return null;
}

function getIncidentSlaPriority(item: IncidentSummary): number {
  if (item.resolved_at) return 5;
  if (item.sla_status === 'breached') return 0;
  if (item.sla_status === 'at_risk') return 1;
  if (item.sla_status === 'on_track') return 2;
  return 3;
}

const bulkResolveReasonOptions = [
  { code: 'DELIVERY_CONFIRMED_EXTERNALLY', label: 'Entrega confirmada externamente' },
  { code: 'CUSTOMER_RESCHEDULED', label: 'Cliente reprogramado' },
  { code: 'DUPLICATE_INCIDENT', label: 'Incidencia duplicada' },
  { code: 'DATA_CORRECTION', label: 'Correccion de datos operativos' },
  { code: 'OTHER', label: 'Otro motivo' },
] as const;

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
  const [bulkScope, setBulkScope] = useState<'selected' | 'filtered'>('selected');
  const [bulkResolveNotes, setBulkResolveNotes] = useState('Resueltas en lote desde panel web');
  const [bulkResolveReasonCode, setBulkResolveReasonCode] = useState<IncidentBulkReasonCode>('DATA_CORRECTION');
  const [bulkResolveReasonDetail, setBulkResolveReasonDetail] = useState('');
  const [bulkOverridePriority, setBulkOverridePriority] = useState<'' | 'high' | 'medium' | 'low'>('');
  const [bulkOverrideDueAt, setBulkOverrideDueAt] = useState('');
  const [bulkOverrideReason, setBulkOverrideReason] = useState('');
  const [singleOverrideTarget, setSingleOverrideTarget] = useState<IncidentSummary | null>(null);
  const [singleOverridePriority, setSingleOverridePriority] = useState<'' | 'high' | 'medium' | 'low'>('');
  const [singleOverrideDueAt, setSingleOverrideDueAt] = useState('');
  const [singleOverrideReason, setSingleOverrideReason] = useState('');
  const [singleOverrideSaving, setSingleOverrideSaving] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<IncidentSummary | null>(null);
  const [resolveNotes, setResolveNotes] = useState('Resuelta desde panel web');
  const [resolveReasonCode, setResolveReasonCode] = useState<IncidentBulkReasonCode>('DATA_CORRECTION');
  const [resolveReasonDetail, setResolveReasonDetail] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [createError, setCreateError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedFromParams = useRef(false);
  const incidentsFilterStorageKey = 'eco_delivery_routes_incidents_filters';
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkSlaPanel, setShowBulkSlaPanel] = useState(false);
  const [slaQueueMode, setSlaQueueMode] = useState(false);
  const [activityIncidentId, setActivityIncidentId] = useState('');
  const [showAudit, setShowAudit] = useState(false);
  const [slaRecommendations, setSlaRecommendations] = useState<IncidentSlaRecommendationAction[]>([]);
  const [applyingRecommendationKey, setApplyingRecommendationKey] = useState<string | null>(null);

  const incidentSummary = useMemo(() => {
    const openCount = items.filter((item) => !item.resolved_at).length;
    const resolvedCount = items.length - openCount;
    return {
      pageCount: items.length,
      open: openCount,
      resolved: resolvedCount,
    };
  }, [items]);

  const activeFiltersCount = useMemo(() => {
    return [
      resolvedFilter,
      listTypeFilter,
      listCategoryFilter,
      listCatalogFilter,
      listPriorityFilter,
      listSlaFilter,
      listIncidentableId,
      listSearch,
    ].filter((value) => value !== '').length;
  }, [
    resolvedFilter,
    listTypeFilter,
    listCategoryFilter,
    listCatalogFilter,
    listPriorityFilter,
    listSlaFilter,
    listIncidentableId,
    listSearch,
  ]);

  const selectedOpenCount = useMemo(
    () => items.filter((item) => !item.resolved_at && selectedIncidentIds.includes(item.id)).length,
    [items, selectedIncidentIds]
  );

  const bulkTargetEstimate = useMemo(() => {
    if (bulkScope === 'selected') return selectedOpenCount;
    return board?.total_open ?? items.filter((item) => !item.resolved_at).length;
  }, [bulkScope, selectedOpenCount, board?.total_open, items]);

  const bulkImpactSummary = useMemo(() => {
    const changes: string[] = [];
    if (bulkOverridePriority) changes.push(`prioridad => ${bulkOverridePriority}`);
    if (bulkOverrideDueAt.trim()) changes.push(`sla_due_at => ${bulkOverrideDueAt.trim()}`);
    if (!changes.length) return 'Sin cambios definidos para override SLA.';
    return `Cambios a aplicar: ${changes.join(' | ')}`;
  }, [bulkOverridePriority, bulkOverrideDueAt]);

  const displayedItems = useMemo(() => {
    if (!slaQueueMode) return items;
    return items.slice().sort((a, b) => {
      const left = getIncidentSlaPriority(a);
      const right = getIncidentSlaPriority(b);
      if (left !== right) return left - right;
      const leftDue = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    });
  }, [items, slaQueueMode]);

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
      return apiClient.getIncidentSlaRecommendations();
    }).then((recommendations) => {
      setSlaRecommendations(recommendations.actions ?? []);
    }).catch(() => {
      setBoard(null);
      setSlaRecommendations([]);
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
    const incidentIdParam = searchParams.get('incident_id') ?? '';
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
    if (incidentIdParam) setListSearch(incidentIdParam);
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

  useEffect(() => {
    if (!items.length) {
      setActivityIncidentId('');
      return;
    }
    if (!activityIncidentId || !items.some((item) => item.id === activityIncidentId)) {
      setActivityIncidentId(items[0].id);
    }
  }, [items, activityIncidentId]);

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

  const applyOperationalPreset = (
    preset: 'sla_breached' | 'open_high_priority' | 'pickup_incidents' | 'mass_data_correction'
  ) => {
    if (preset === 'sla_breached') {
      setResolvedFilter('open');
      setListSlaFilter('breached');
      setListPriorityFilter('');
      setListTypeFilter('');
      setPage(1);
      return;
    }
    if (preset === 'open_high_priority') {
      setResolvedFilter('open');
      setListPriorityFilter('high');
      setListSlaFilter('');
      setListTypeFilter('');
      setPage(1);
      return;
    }
    if (preset === 'pickup_incidents') {
      setResolvedFilter('open');
      setListTypeFilter('pickup');
      setListSlaFilter('');
      setListPriorityFilter('');
      setPage(1);
      return;
    }
    setBulkScope('filtered');
    setBulkResolveReasonCode('DATA_CORRECTION');
    setBulkResolveReasonDetail('');
    setBulkResolveNotes('Resueltas masivamente por correccion operativa de datos');
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

  const onResolve = (item: IncidentSummary) => {
    setResolveTarget(item);
    setResolveNotes('Resuelta desde panel web');
    setResolveReasonCode('DATA_CORRECTION');
    setResolveReasonDetail('');
    setResolveError('');
  };

  const confirmResolve = async () => {
    if (!resolveTarget) return;
    if (resolveNotes.trim().length < 8) {
      setResolveError('Define una nota de resolución (mínimo 8 caracteres).');
      return;
    }
    if (resolveReasonCode === 'OTHER' && !resolveReasonDetail.trim()) {
      setResolveError('Cuando el motivo es OTHER, indica también un detalle.');
      return;
    }
    setResolvingId(resolveTarget.id);
    setResolveError('');
    try {
      await apiClient.resolveIncident(resolveTarget.id, {
        notes: resolveNotes.trim(),
        reasonCode: resolveReasonCode,
        reasonDetail: resolveReasonDetail.trim() || undefined,
      });
      await reload();
      setResolveTarget(null);
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
    const validationError = validateIncidentBulkResolve({
      scope: bulkScope,
      selectedCount: selectedIncidentIds.length,
      reasonCode: bulkResolveReasonCode,
      reasonDetail: bulkResolveReasonDetail,
      notes: bulkResolveNotes,
    });
    if (validationError) {
      setResolveError(validationError);
      return;
    }
    setBulkResolving(true);
    setResolveError('');
    try {
      const reasonLabel = bulkResolveReasonOptions.find((item) => item.code === bulkResolveReasonCode)?.label ?? bulkResolveReasonCode;
      const composedNotes = composeIncidentBulkResolveNotes({
        reasonCode: bulkResolveReasonCode,
        reasonLabel,
        reasonDetail: bulkResolveReasonDetail,
        notes: bulkResolveNotes,
      });
      await apiClient.resolveIncidentsBulk(
        selectedIncidentIds,
        composedNotes,
        {
          code: bulkResolveReasonCode,
          detail: bulkResolveReasonDetail.trim() || undefined,
        },
        {
          applyToFiltered: bulkScope === 'filtered',
          filters: bulkScope === 'filtered' ? {
            incidentableType: listTypeFilter || undefined,
            incidentableId: listIncidentableId || undefined,
            q: listSearch || undefined,
            category: listCategoryFilter || undefined,
            catalogCode: listCatalogFilter || undefined,
            priority: listPriorityFilter || undefined,
            slaStatus: listSlaFilter || undefined,
            resolved: resolvedFilter || undefined,
          } : undefined,
        }
      );
      setSelectedIncidentIds([]);
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo resolver incidencias en lote');
    } finally {
      setBulkResolving(false);
    }
  };

  const selectOpenInPage = () => {
    setBulkScope('selected');
    setSelectedIncidentIds(items.filter((item) => !item.resolved_at).map((item) => item.id));
  };

  const selectBreachedInPage = () => {
    setBulkScope('selected');
    setSelectedIncidentIds(items.filter((item) => !item.resolved_at && item.sla_status === 'breached').map((item) => item.id));
  };

  const onBulkOverrideSla = async () => {
    if (!bulkOverridePriority && !bulkOverrideDueAt.trim()) {
      setResolveError('Define prioridad o due_at para el ajuste SLA masivo.');
      return;
    }
    if (!bulkOverrideReason.trim()) {
      setResolveError('Define un motivo para el ajuste SLA masivo.');
      return;
    }
    try {
      await apiClient.overrideIncidentSlaBulk({
        incidentIds: bulkScope === 'selected' ? selectedIncidentIds : [],
        applyToFiltered: bulkScope === 'filtered',
        filters: bulkScope === 'filtered' ? {
          incidentableType: listTypeFilter || undefined,
          incidentableId: listIncidentableId || undefined,
          q: listSearch || undefined,
          category: listCategoryFilter || undefined,
          catalogCode: listCatalogFilter || undefined,
          priority: listPriorityFilter || undefined,
          slaStatus: listSlaFilter || undefined,
          resolved: resolvedFilter || undefined,
        } : undefined,
        priority: bulkOverridePriority || undefined,
        slaDueAt: bulkOverrideDueAt.trim() || undefined,
        reason: bulkOverrideReason.trim(),
      });
      setBulkOverridePriority('');
      setBulkOverrideDueAt('');
      setBulkOverrideReason('');
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo aplicar override SLA masivo');
    }
  };

  const openSingleOverride = (item: IncidentSummary) => {
    setSingleOverrideTarget(item);
    setSingleOverridePriority((item.priority === 'high' || item.priority === 'medium' || item.priority === 'low') ? item.priority : '');
    setSingleOverrideDueAt(item.sla_due_at ?? '');
    setSingleOverrideReason('');
    setResolveError('');
  };

  const onOverrideSla = async () => {
    if (!singleOverrideTarget) return;
    if (!singleOverridePriority && !singleOverrideDueAt.trim()) {
      setResolveError('Define prioridad o due_at para el ajuste SLA.');
      return;
    }
    if (!singleOverrideReason.trim()) {
      setResolveError('Define un motivo para el ajuste SLA.');
      return;
    }
    setSingleOverrideSaving(true);
    try {
      await apiClient.overrideIncidentSla(singleOverrideTarget.id, {
        priority: singleOverridePriority || undefined,
        sla_due_at: singleOverrideDueAt.trim() || undefined,
        reason: singleOverrideReason.trim(),
      });
      setSingleOverrideTarget(null);
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo ajustar SLA');
    } finally {
      setSingleOverrideSaving(false);
    }
  };

  const onEscalatePriority = async (item: IncidentSummary) => {
    const reason = `Escalado manual desde panel (${new Date().toISOString()})`;
    try {
      await apiClient.overrideIncidentSla(item.id, {
        priority: 'high',
        reason,
      });
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo escalar prioridad');
    }
  };

  const onApplySlaRecommendation = async (action: IncidentSlaRecommendationAction) => {
    setApplyingRecommendationKey(action.key);
    setResolveError('');
    try {
      const result = await apiClient.applyIncidentSlaRecommendation(action.key);
      setResolveError(result.updated_count > 0 ? '' : 'No había incidencias abiertas para aplicar la recomendación.');
      await reload();
    } catch (exception) {
      setResolveError(exception instanceof Error ? exception.message : 'No se pudo aplicar la recomendación SLA');
    } finally {
      setApplyingRecommendationKey(null);
    }
  };

  return (
    <section className="page-grid">
      <div className="inline-actions">
        <Link to="/dashboard" className="helper">Dashboard</Link>
        <span className="helper">/</span>
        <span className="helper">Incidencias</span>
      </div>
      <Modal
        open={resolveTarget !== null}
        title={`Resolver incidencia · ${resolveTarget?.reference ?? resolveTarget?.id ?? ''}`}
        onClose={() => setResolveTarget(null)}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setResolveTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmResolve} disabled={resolvingId !== null}>
              {resolvingId ? 'Resolviendo...' : 'Resolver incidencia'}
            </Button>
          </>
        )}
      >
        <div className="page-grid">
          <div className="form-row">
            <div>
              <label>Motivo estructurado</label>
              <Select value={resolveReasonCode} onChange={(event) => setResolveReasonCode(event.target.value as IncidentBulkReasonCode)}>
                {bulkResolveReasonOptions.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label>Detalle del motivo</label>
              <Input
                value={resolveReasonDetail}
                onChange={(event) => setResolveReasonDetail(event.target.value)}
                placeholder="Detalle opcional"
              />
            </div>
          </div>
          <div>
            <label>Nota de resolución</label>
            <Input
              value={resolveNotes}
              onChange={(event) => setResolveNotes(event.target.value)}
              placeholder="Describe la resolución"
            />
          </div>
        </div>
      </Modal>
      <Modal
        open={singleOverrideTarget !== null}
        title={`Ajustar SLA · ${singleOverrideTarget?.id ?? ''}`}
        onClose={() => setSingleOverrideTarget(null)}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setSingleOverrideTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={onOverrideSla} disabled={singleOverrideSaving}>
              {singleOverrideSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label>Prioridad</label>
            <Select value={singleOverridePriority} onChange={(event) => setSingleOverridePriority(event.target.value as '' | 'high' | 'medium' | 'low')}>
              <option value="">Sin cambio</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </Select>
          </div>
          <div>
            <label>SLA due_at (ISO)</label>
            <Input
              value={singleOverrideDueAt}
              onChange={(event) => setSingleOverrideDueAt(event.target.value)}
              placeholder="2026-03-31T14:00:00Z"
            />
          </div>
          <div>
            <label>Motivo</label>
            <Input
              value={singleOverrideReason}
              onChange={(event) => setSingleOverrideReason(event.target.value)}
              placeholder="Motivo del ajuste"
            />
          </div>
        </div>
      </Modal>
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
          <CardTitle>Automatización SLA</CardTitle>
          <CardDescription>Recomendaciones para reducir incidencias en riesgo y vencidas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="page-grid">
            {slaRecommendations.length === 0 ? (
              <div className="helper">No hay recomendaciones SLA disponibles.</div>
            ) : (
              slaRecommendations.map((action) => (
                <div key={action.key} className="card">
                  <div className="inline-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <div className="kpi-label">{action.label}</div>
                      <div className="helper">{action.description}</div>
                    </div>
                    <Badge variant="outline">Objetivo {action.estimated_count}</Badge>
                  </div>
                  <div className="helper">
                    Recomendado: prioridad <strong>{action.recommended_payload.priority}</strong> · due_at {action.recommended_payload.sla_due_at}
                  </div>
                  <div className="inline-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { void onApplySlaRecommendation(action); }}
                      disabled={applyingRecommendationKey !== null}
                    >
                      {applyingRecommendationKey === action.key ? 'Aplicando...' : 'Aplicar recomendación'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
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
          <div className="inline-actions ops-toolbar">
            <Button type="button" variant={showFilters ? 'secondary' : 'outline'} onClick={() => setShowFilters((value) => !value)}>
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </Button>
            <span className="helper">Filtros activos: {activeFiltersCount}</span>
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
            <Button
              type="button"
              variant={slaQueueMode ? 'secondary' : 'outline'}
              onClick={() => setSlaQueueMode((value) => !value)}
            >
              {slaQueueMode ? 'Vista normal' : 'Cola SLA'}
            </Button>
          </div>
          <div className="inline-actions ops-toolbar">
            <span className="helper">Presets operativos</span>
            <Button type="button" variant="outline" onClick={() => applyOperationalPreset('sla_breached')}>
              SLA vencido
            </Button>
            <Button type="button" variant="outline" onClick={() => applyOperationalPreset('open_high_priority')}>
              Alta prioridad
            </Button>
            <Button type="button" variant="outline" onClick={() => applyOperationalPreset('pickup_incidents')}>
              Solo pickups
            </Button>
            <Button type="button" variant="outline" onClick={() => applyOperationalPreset('mass_data_correction')}>
              Prep cierre por correccion
            </Button>
          </div>
          {showFilters ? (
            <div className="filters-panel">
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
            </div>
          ) : null}
          <div className="inline-actions ops-toolbar">
            <Button type="button" variant={bulkScope === 'selected' ? 'secondary' : 'outline'} onClick={() => setBulkScope('selected')}>
              Modo selección
            </Button>
            <Button type="button" variant={bulkScope === 'filtered' ? 'secondary' : 'outline'} onClick={() => setBulkScope('filtered')}>
              Modo filtro completo
            </Button>
            <Button type="button" variant="outline" onClick={selectOpenInPage}>
              Seleccionar abiertas (página)
            </Button>
            <Button type="button" variant="outline" onClick={selectBreachedInPage}>
              Seleccionar SLA vencido
            </Button>
            <Select value={bulkResolveReasonCode} onChange={(event) => setBulkResolveReasonCode(event.target.value as IncidentBulkReasonCode)}>
              {bulkResolveReasonOptions.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </Select>
            <Input
              value={bulkResolveReasonDetail}
              onChange={(event) => setBulkResolveReasonDetail(event.target.value)}
              placeholder="Detalle del motivo (opcional)"
            />
            <Input
              value={bulkResolveNotes}
              onChange={(event) => setBulkResolveNotes(event.target.value)}
              placeholder="Nota de resolucion masiva"
            />
            <Button type="button" onClick={onResolveSelected} disabled={bulkResolving || (bulkScope === 'selected' && selectedIncidentIds.length === 0)}>
              {bulkResolving ? 'Resolviendo...' : bulkScope === 'filtered'
                ? 'Resolver abiertas del filtro'
                : `Resolver seleccionadas (${selectedIncidentIds.length})`}
            </Button>
          </div>
          <div className="helper">
            Impacto cierre masivo: objetivo estimado {bulkTargetEstimate} incidencia(s) abierta(s).
          </div>
          <div className="inline-actions ops-toolbar">
            <Button type="button" variant={showBulkSlaPanel ? 'secondary' : 'outline'} onClick={() => setShowBulkSlaPanel((value) => !value)}>
              {showBulkSlaPanel ? 'Ocultar override SLA' : 'Mostrar override SLA'}
            </Button>
          </div>
          {showBulkSlaPanel ? (
            <div className="filters-panel">
              <div className="helper">Override SLA masivo</div>
              <div className="form-row">
                <div>
                  <label>Prioridad</label>
                  <Select value={bulkOverridePriority} onChange={(event) => setBulkOverridePriority(event.target.value as '' | 'high' | 'medium' | 'low')}>
                    <option value="">Sin cambio</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </Select>
                </div>
                <div>
                  <label>SLA due_at (ISO)</label>
                  <Input
                    value={bulkOverrideDueAt}
                    onChange={(event) => setBulkOverrideDueAt(event.target.value)}
                    placeholder="2026-03-31T14:00:00Z"
                  />
                </div>
                <div>
                  <label>Motivo</label>
                  <Input
                    value={bulkOverrideReason}
                    onChange={(event) => setBulkOverrideReason(event.target.value)}
                    placeholder="Motivo del ajuste masivo"
                  />
                </div>
              </div>
              <div className="inline-actions">
                <Button type="button" variant="outline" onClick={onBulkOverrideSla} disabled={bulkScope === 'selected' && selectedIncidentIds.length === 0}>
                  Aplicar override SLA
                </Button>
              </div>
              <div className="helper">
                Impacto override masivo: objetivo estimado {bulkTargetEstimate} incidencia(s). {bulkImpactSummary}
              </div>
            </div>
          ) : null}
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sel</TableHead>
                  <TableHead>Incidencia ID</TableHead>
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
                {displayedItems.map((item) => (
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
                    <TableCell>{item.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.incidentable_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {getIncidentEntityHref(item) ? (
                        <Link to={getIncidentEntityHref(item) as string}>{item.incidentable_id}</Link>
                      ) : item.incidentable_id}
                    </TableCell>
                    <TableCell>
                      {item.shipment_reference ? (
                        <Link to={`/shipments?q=${encodeURIComponent(item.shipment_reference)}`}>{item.shipment_reference}</Link>
                      ) : '-'}
                    </TableCell>
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
                          <Button type="button" onClick={() => onResolve(item)} disabled={resolvingId === item.id}>
                            {resolvingId === item.id ? 'Resolviendo...' : 'Resolver'}
                          </Button>
                          {item.priority !== 'high' ? (
                            <Button type="button" variant="outline" onClick={() => onEscalatePriority(item)}>Escalar alta</Button>
                          ) : null}
                          <Button type="button" variant="outline" onClick={() => openSingleOverride(item)}>Ajustar SLA</Button>
                          {item.incidentable_type === 'shipment' ? (
                            <Link to={`/shipments/${item.incidentable_id}`} className="btn btn-outline">Ver envío</Link>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {displayedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12}>Sin incidencias para los filtros seleccionados.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {displayedItems.map((item) => (
              <article key={`mobile-incident-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{item.catalog_code}</strong>
                    <div className="helper">{item.id}</div>
                  </div>
                  <Badge variant={categoryVariant(item.category)}>{item.category}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Referencia</div>
                    <div>{item.shipment_reference ?? item.incidentable_id}</div>
                  </div>
                  <div>
                    <div className="kpi-label">SLA</div>
                    <div>{item.sla_status ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Prioridad</div>
                    <div>{item.priority ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Estado</div>
                    <div>{item.resolved_at ? 'resuelta' : 'abierta'}</div>
                  </div>
                </div>
                <div className="helper">{formatSlaTimeline(item)}</div>
                <div className="mobile-ops-card-actions">
                  {!item.resolved_at ? (
                    <Button type="button" onClick={() => onResolve(item)} disabled={resolvingId === item.id}>
                      {resolvingId === item.id ? 'Resolviendo...' : 'Resolver'}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => openSingleOverride(item)}>
                    Ajustar SLA
                  </Button>
                  {item.incidentable_type === 'shipment' ? (
                    <Link to={`/shipments/${item.incidentable_id}`} className="btn btn-outline">
                      Ver envío
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
            {displayedItems.length === 0 ? (
              <div className="mobile-ops-empty">Sin incidencias para los filtros seleccionados.</div>
            ) : null}
          </div>
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
      <Card>
        <CardHeader>
          <CardTitle>Auditoría</CardTitle>
          <CardDescription>Acceso bajo demanda al timeline auditado.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => setShowAudit((value) => !value)}>
            {showAudit ? 'Ocultar auditoría' : 'Mostrar auditoría'}
          </Button>
        </CardContent>
      </Card>
      {showAudit ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Actividad de incidencia</CardTitle>
              <CardDescription>Timeline auditado de acciones sobre una incidencia concreta.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-actions">
                <Select value={activityIncidentId} onChange={(event) => setActivityIncidentId(event.target.value)}>
                  <option value="">Selecciona incidencia</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.catalog_code} · {item.incidentable_id} · {item.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>
          <EntityActivityTimeline
            title="Auditoría de incidencia seleccionada"
            resource="incident"
            entityId={activityIncidentId || undefined}
            eventPrefix="incidents."
          />
        </>
      ) : null}
    </section>
  );
}
