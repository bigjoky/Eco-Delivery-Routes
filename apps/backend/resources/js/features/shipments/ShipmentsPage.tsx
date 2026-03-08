import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { Modal } from '../../components/ui/modal';
import { AuditLogEntry, DepotSummary, HubSummary, IncidentCatalogItem, PaginationMeta, PointSummary, ShipmentImportJob, ShipmentSummary } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { apiClient } from '../../services/apiClient';
import {
  hasRequiredRecipientName,
  hasRequiredSenderName,
  inferDocumentType,
  isValidEmail,
  isValidPhone,
  isValidPostalCode,
} from './shipmentFormValidation';
import { buildAddressSuggestions } from './addressAutocomplete';

function shipmentVariant(status: string): 'default' | 'secondary' | 'warning' | 'success' {
  if (status === 'delivered') return 'success';
  if (status === 'out_for_delivery') return 'secondary';
  if (status === 'incident') return 'warning';
  return 'default';
}

function shipmentStatusHelp(status: string): string {
  const help: Record<string, string> = {
    created: 'Creado en sistema, pendiente de procesamiento.',
    out_for_delivery: 'En reparto, asignado a ruta.',
    delivered: 'Entregado con POD.',
    incident: 'Con incidencia activa.',
  };
  return help[status] ?? status;
}

function serviceTypeLabel(value?: string | null) {
  if (!value) return '-';
  const labels: Record<string, string> = {
    express_1030: 'Express 10:30',
    express_1400: 'Express 14:00',
    express_1900: 'Express 19:00',
    economy_parcel: 'Economy Parcel',
    business_parcel: 'Business Parcel',
    thermo_parcel: 'Thermo Parcel',
    delivery: 'Delivery',
  };
  return labels[value] ?? value;
}

type ShipmentFiltersProps = {
  query: string;
  setQuery: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  hubFilter: string;
  setHubFilter: (value: string) => void;
  scheduledFrom: string;
  setScheduledFrom: (value: string) => void;
  scheduledTo: string;
  setScheduledTo: (value: string) => void;
  hubs: HubSummary[];
  setQuickRange: (range: 'today' | 'tomorrow' | 'next7' | 'clear') => void;
  clearFilters: () => void;
  canExport: boolean;
  exportCsv: () => void;
  exportPdf: () => void;
};

function ShipmentFilters({
  query,
  setQuery,
  status,
  setStatus,
  hubFilter,
  setHubFilter,
  scheduledFrom,
  setScheduledFrom,
  scheduledTo,
  setScheduledTo,
  hubs,
  setQuickRange,
  clearFilters,
  canExport,
  exportCsv,
  exportPdf,
}: ShipmentFiltersProps) {
  return (
    <div className="filters-panel">
      <label htmlFor="shipment-query">Buscar</label>
      <input
        id="shipment-query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Referencia, externa, ID o destinatario"
      />
      <div className="inline-actions">
        <span className="helper">Estados rapidos</span>
        <Button type="button" variant={status === '' ? 'secondary' : 'outline'} onClick={() => setStatus('')}>Todos</Button>
        <Button type="button" variant={status === 'created' ? 'secondary' : 'outline'} onClick={() => setStatus('created')}>Created</Button>
        <Button type="button" variant={status === 'out_for_delivery' ? 'secondary' : 'outline'} onClick={() => setStatus('out_for_delivery')}>Out</Button>
        <Button type="button" variant={status === 'delivered' ? 'secondary' : 'outline'} onClick={() => setStatus('delivered')}>Delivered</Button>
        <Button type="button" variant={status === 'incident' ? 'secondary' : 'outline'} onClick={() => setStatus('incident')}>Incident</Button>
        <Button type="button" variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
      </div>
      <label htmlFor="shipment-status">Estado</label>
      <select
        id="shipment-status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">Todos</option>
        <option value="created">created</option>
        <option value="out_for_delivery">out_for_delivery</option>
        <option value="delivered">delivered</option>
        <option value="incident">incident</option>
      </select>
      <label htmlFor="shipment-hub">Hub</label>
      <select
        id="shipment-hub"
        value={hubFilter}
        onChange={(event) => setHubFilter(event.target.value)}
      >
        <option value="">Todos</option>
        {hubs.map((hub) => (
          <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
        ))}
      </select>
      <label htmlFor="shipment-date-from">Desde</label>
      <input
        id="shipment-date-from"
        type="date"
        value={scheduledFrom}
        onChange={(event) => setScheduledFrom(event.target.value)}
      />
      <label htmlFor="shipment-date-to">Hasta</label>
      <input
        id="shipment-date-to"
        type="date"
        value={scheduledTo}
        onChange={(event) => setScheduledTo(event.target.value)}
      />
      <div className="inline-actions">
        <span className="helper">Rangos rapidos</span>
        <Button type="button" variant="outline" onClick={() => setQuickRange('today')}>Hoy</Button>
        <Button type="button" variant="outline" onClick={() => setQuickRange('tomorrow')}>Manana</Button>
        <Button type="button" variant="outline" onClick={() => setQuickRange('next7')}>Prox 7 dias</Button>
        <Button type="button" variant="outline" onClick={() => setQuickRange('clear')}>Limpiar</Button>
      </div>
      <div className="inline-actions">
        <Button type="button" variant="outline" onClick={exportCsv} disabled={!canExport}>
          Export CSV
        </Button>
        <Button type="button" variant="outline" onClick={exportPdf} disabled={!canExport}>
          Export PDF
        </Button>
      </div>
    </div>
  );
}

type ShipmentQuickTemplate = {
  id: string;
  name: string;
  operation: 'shipment' | 'pickup_normal' | 'pickup_return';
  serviceType: 'express_1030' | 'express_1400' | 'express_1900' | 'economy_parcel' | 'business_parcel' | 'thermo_parcel';
  hubId: string;
  pointId: string;
  recipientDocType: 'DNI' | 'NIE' | 'PASSPORT' | 'CIF';
  recipientDocumentId: string;
  recipientLegalName: string;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  recipientEmail: string;
  recipientStreet: string;
  recipientNumber: string;
  recipientPostalCode: string;
  recipientCity: string;
  recipientProvince: string;
  recipientCountry: string;
  recipientNotes: string;
  senderDocType: 'DNI' | 'NIE' | 'PASSPORT' | 'CIF';
  senderDocumentId: string;
  senderLegalName: string;
  senderFirstName: string;
  senderLastName: string;
  senderPhone: string;
  senderEmail: string;
  senderStreet: string;
  senderNumber: string;
  senderPostalCode: string;
  senderCity: string;
  senderProvince: string;
  senderCountry: string;
  senderNotes: string;
};

export function ShipmentsPage() {
  const [items, setItems] = useState<ShipmentSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [status, setStatus] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'scheduled_at' | 'reference' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [scheduledFrom, setScheduledFrom] = useState('');
  const [scheduledTo, setScheduledTo] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedFromParams = useRef(false);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [hubDepots, setHubDepots] = useState<DepotSummary[]>([]);
  const [hubPoints, setHubPoints] = useState<PointSummary[]>([]);
  const [createHubId, setCreateHubId] = useState('');
  const [createPointId, setCreatePointId] = useState('');
  const [createExternalReference, setCreateExternalReference] = useState('');
  const [createConsignee, setCreateConsignee] = useState('');
  const [createConsigneeDocumentId, setCreateConsigneeDocumentId] = useState('');
  const [createConsigneeDocType, setCreateConsigneeDocType] = useState<'DNI' | 'NIE' | 'PASSPORT' | 'CIF'>('DNI');
  const [createConsigneeFirstName, setCreateConsigneeFirstName] = useState('');
  const [createConsigneeLastName, setCreateConsigneeLastName] = useState('');
  const [createStreet, setCreateStreet] = useState('');
  const [createNumber, setCreateNumber] = useState('');
  const [createPostalCode, setCreatePostalCode] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createProvince, setCreateProvince] = useState('');
  const [createCountry, setCreateCountry] = useState('ES');
  const [createAddressNotes, setCreateAddressNotes] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createSenderLegalName, setCreateSenderLegalName] = useState('');
  const [createSenderDocumentId, setCreateSenderDocumentId] = useState('');
  const [createSenderDocType, setCreateSenderDocType] = useState<'DNI' | 'NIE' | 'PASSPORT' | 'CIF'>('DNI');
  const [createSenderFirstName, setCreateSenderFirstName] = useState('');
  const [createSenderLastName, setCreateSenderLastName] = useState('');
  const [createSenderStreet, setCreateSenderStreet] = useState('');
  const [createSenderNumber, setCreateSenderNumber] = useState('');
  const [createSenderPostalCode, setCreateSenderPostalCode] = useState('');
  const [createSenderCity, setCreateSenderCity] = useState('');
  const [createSenderProvince, setCreateSenderProvince] = useState('');
  const [createSenderCountry, setCreateSenderCountry] = useState('ES');
  const [createSenderAddressNotes, setCreateSenderAddressNotes] = useState('');
  const [createSenderPhone, setCreateSenderPhone] = useState('');
  const [createSenderEmail, setCreateSenderEmail] = useState('');
  const [createOperation, setCreateOperation] = useState<'shipment' | 'pickup_normal' | 'pickup_return'>('shipment');
  const [createServiceType, setCreateServiceType] = useState<'express_1030' | 'express_1400' | 'express_1900' | 'economy_parcel' | 'business_parcel' | 'thermo_parcel'>('express_1030');
  const [createScheduledAt, setCreateScheduledAt] = useState(new Date().toISOString().slice(0, 10));
  const [wizardMode, setWizardMode] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [senderModalOpen, setSenderModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createFieldErrors, setCreateFieldErrors] = useState<{
    hub?: string;
    scheduledAt?: string;
    recipientDocument?: string;
    recipientName?: string;
    recipientPhone?: string;
    street?: string;
    city?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    senderPhone?: string;
    senderEmail?: string;
    senderStreet?: string;
    senderPostalCode?: string;
    senderCity?: string;
    senderDocument?: string;
    senderName?: string;
  }>({});
  const [creating, setCreating] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportColumns, setExportColumns] = useState<string[]>([
    'reference',
    'external_reference',
    'status',
    'service_type',
    'consignee_name',
    'address_street',
    'address_number',
    'postal_code',
    'city',
    'province',
    'country',
    'scheduled_at',
    'delivered_at',
    'hub_code',
  ]);
  const defaultExportColumns = [
    'reference',
    'external_reference',
    'status',
    'service_type',
    'consignee_name',
    'address_street',
    'address_number',
    'postal_code',
    'city',
    'province',
    'country',
    'scheduled_at',
    'delivered_at',
    'hub_code',
  ];
  const shipmentTemplatesStorageKey = 'eco_delivery_routes_shipments_quick_templates';
  const [shipmentTemplates, setShipmentTemplates] = useState<ShipmentQuickTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const exportColumnsStorageKey = 'eco_delivery_routes_shipments_export_columns';
  const wizardStorageKey = 'eco_delivery_routes_shipments_wizard_state';
  const [consigneeLookupPhone, setConsigneeLookupPhone] = useState('');
  const [consigneeLookupDocument, setConsigneeLookupDocument] = useState('');
  const [consigneeLookupError, setConsigneeLookupError] = useState('');
  const [consigneeLookupLoading, setConsigneeLookupLoading] = useState(false);
  const [senderLookupPhone, setSenderLookupPhone] = useState('');
  const [senderLookupDocument, setSenderLookupDocument] = useState('');
  const [senderLookupError, setSenderLookupError] = useState('');
  const [senderLookupLoading, setSenderLookupLoading] = useState(false);
  const [recipientAddressSuggestions, setRecipientAddressSuggestions] = useState<Array<{
    address_street?: string | null;
    address_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    address_notes?: string | null;
  }>>([]);
  const [senderAddressSuggestions, setSenderAddressSuggestions] = useState<Array<{
    address_street?: string | null;
    address_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    address_notes?: string | null;
  }>>([]);
  const [importSummary, setImportSummary] = useState<null | Record<string, number>>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDryRun, setImportDryRun] = useState(true);
  const [importResult, setImportResult] = useState<null | {
    dry_run: boolean;
    created_count: number;
    skipped_count: number;
    error_count: number;
    rows: Array<{ row: number; reference?: string; status: string; errors?: string[] }>;
  }>(null);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [importAsync, setImportAsync] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importJob, setImportJob] = useState<ShipmentImportJob | null>(null);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkHubId, setBulkHubId] = useState('');
  const [bulkScheduledAt, setBulkScheduledAt] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkApplyToFiltered, setBulkApplyToFiltered] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkPreviewing, setBulkPreviewing] = useState(false);
  const [bulkPreviewCount, setBulkPreviewCount] = useState<number | null>(null);
  const [bulkPreviewSample, setBulkPreviewSample] = useState<Array<{ id: string; reference: string; status: string }>>([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [incidentCatalog, setIncidentCatalog] = useState<IncidentCatalogItem[]>([]);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentTarget, setIncidentTarget] = useState<ShipmentSummary | null>(null);
  const [incidentCatalogCode, setIncidentCatalogCode] = useState('');
  const [incidentCategory, setIncidentCategory] = useState<'failed' | 'absent' | 'retry' | 'general'>('general');
  const [incidentNotes, setIncidentNotes] = useState('');
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentError, setIncidentError] = useState('');
  const [roles, setRoles] = useState(sessionStore.getRoles());
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const isMock = !apiBase || apiBase === 'undefined' || apiBase === 'null';
  const canExport = isMock || roles.some((role) => (
    role === 'super_admin' || role === 'operations_manager' || role === 'traffic_operator' || role === 'accountant'
  ));
  const canImport = isMock || roles.some((role) => (
    role === 'super_admin' || role === 'operations_manager' || role === 'traffic_operator'
  ));

  const shipmentSummary = useMemo(() => {
    const counts = items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: meta.total,
      created: counts.created ?? 0,
      out: counts.out_for_delivery ?? 0,
      delivered: counts.delivered ?? 0,
      incident: counts.incident ?? 0,
      pageCount: items.length,
    };
  }, [items, meta.total]);
  const bulkTargetCount = bulkApplyToFiltered ? shipmentSummary.total : selectedShipmentIds.length;

  const activeFiltersCount = useMemo(() => {
    return [query, status, hubFilter, scheduledFrom, scheduledTo].filter((value) => value !== '').length;
  }, [query, status, hubFilter, scheduledFrom, scheduledTo]);

  const availableIncidentCatalog = useMemo(
    () => incidentCatalog.filter((item) => item.applies_to === 'shipment' || item.applies_to === 'both'),
    [incidentCatalog]
  );

  const reload = (page: number, nextStatus: string = status) =>
    apiClient.getShipments({
      page,
      perPage,
      status: nextStatus || undefined,
      hubId: hubFilter || undefined,
      q: query || undefined,
      scheduledFrom: scheduledFrom || undefined,
      scheduledTo: scheduledTo || undefined,
      sort: sortField,
      dir: sortDir,
    }).then((result) => {
      setItems(result.data);
      setMeta(result.meta);
    });

  useEffect(() => {
    if (!initializedFromParams.current) return;
    reload(1);
  }, [status, hubFilter, query, scheduledFrom, scheduledTo, sortField, sortDir, perPage]);

  useEffect(() => {
    if (initializedFromParams.current) return;
    const statusParam = searchParams.get('status') ?? '';
    const hubParam = searchParams.get('hub_id') ?? '';
    const qParam = searchParams.get('q') ?? '';
    const scheduledFromParam = searchParams.get('scheduled_from') ?? '';
    const scheduledToParam = searchParams.get('scheduled_to') ?? '';
    const sortParam = searchParams.get('sort') as 'created_at' | 'scheduled_at' | 'reference' | 'status' | null;
    const dirParam = searchParams.get('dir') as 'asc' | 'desc' | null;
    const perPageParam = Number(searchParams.get('per_page') ?? '');

    if (statusParam) setStatus(statusParam);
    if (hubParam) setHubFilter(hubParam);
    if (qParam) setQuery(qParam);
    if (scheduledFromParam) setScheduledFrom(scheduledFromParam);
    if (scheduledToParam) setScheduledTo(scheduledToParam);
    if (sortParam && ['created_at', 'scheduled_at', 'reference', 'status'].includes(sortParam)) setSortField(sortParam);
    if (dirParam && (dirParam === 'asc' || dirParam === 'desc')) setSortDir(dirParam);
    if (!Number.isNaN(perPageParam) && perPageParam > 0) setPerPage(perPageParam);

    initializedFromParams.current = true;
    const pageParam = Number(searchParams.get('page') ?? '1');
    const initialPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    reload(initialPage);
  }, [searchParams]);

  useEffect(() => {
    if (!initializedFromParams.current) return;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (hubFilter) params.set('hub_id', hubFilter);
    if (query) params.set('q', query);
    if (scheduledFrom) params.set('scheduled_from', scheduledFrom);
    if (scheduledTo) params.set('scheduled_to', scheduledTo);
    if (sortField) params.set('sort', sortField);
    if (sortDir) params.set('dir', sortDir);
    if (perPage) params.set('per_page', String(perPage));
    if (meta.page) params.set('page', String(meta.page));
    setSearchParams(params, { replace: true });
  }, [status, hubFilter, query, scheduledFrom, scheduledTo, sortField, sortDir, perPage, meta.page, setSearchParams]);

  useEffect(() => {
    return sessionStore.subscribe(() => {
      setRoles(sessionStore.getRoles());
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(exportColumnsStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        setExportColumns(parsed);
      }
    } catch {
      // Ignore invalid storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(exportColumnsStorageKey, JSON.stringify(exportColumns));
  }, [exportColumns]);

  useEffect(() => {
    if (!canImport || !importJobId) return;
    let active = true;
    const poll = async () => {
      try {
        const job = await apiClient.getShipmentImportStatus(importJobId);
        if (!active) return;
        setImportJob(job);
        if (job.status === 'completed' || job.status === 'failed') {
          return;
        }
        setTimeout(poll, 5000);
      } catch {
        if (!active) return;
        setTimeout(poll, 8000);
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [canImport, importJobId]);

  useEffect(() => {
    setSelectedShipmentIds((current) => current.filter((id) => items.some((row) => row.id === id)));
  }, [items]);

  useEffect(() => {
    if (!canImport) return;
    setAuditLoading(true);
    apiClient
      .getAuditLogs({ event: 'shipments.', page: 1, perPage: 20 })
      .then((result) => setAuditRows(result.data))
      .catch(() => setAuditRows([]))
      .finally(() => setAuditLoading(false));
  }, [canImport]);

  useEffect(() => {
    apiClient.getHubs({ onlyActive: true }).then((rows) => {
      setHubs(rows);
      if (!createHubId && rows.length > 0) setCreateHubId(rows[0].id);
    }).catch(() => setHubs([]));
  }, []);

  useEffect(() => {
    if (!createHubId) {
      setHubDepots([]);
      setHubPoints([]);
      setCreatePointId('');
      return;
    }
    Promise.all([
      apiClient.getDepots({ hubId: createHubId }),
      apiClient.getPoints({ hubId: createHubId }),
    ]).then(([depots, points]) => {
      setHubDepots(depots);
      setHubPoints(points);
      if (!points.some((item) => item.id === createPointId)) {
        setCreatePointId('');
      }
    }).catch(() => {
      setHubDepots([]);
      setHubPoints([]);
      setCreatePointId('');
    });
  }, [createHubId, createPointId]);

  useEffect(() => {
    if (!createPointId) return;
    const selectedPoint = hubPoints.find((item) => item.id === createPointId);
    if (!selectedPoint) return;
    if (!createStreet.trim() && selectedPoint.address_line) {
      setCreateStreet(selectedPoint.address_line);
      setCreateNumber('');
    }
    if (!createCity.trim() && selectedPoint.city) {
      setCreateCity(selectedPoint.city);
    }
    if (!createAddressNotes.trim()) {
      const depot = selectedPoint.depot_id ? hubDepots.find((item) => item.id === selectedPoint.depot_id) : null;
      const networkHint = depot
        ? `Punto: ${selectedPoint.code} (${depot.code})`
        : `Punto: ${selectedPoint.code}`;
      setCreateAddressNotes(networkHint);
    }
  }, [createPointId, hubPoints, hubDepots]);

  useEffect(() => {
    apiClient.getIncidentCatalog().then((entries) => {
      setIncidentCatalog(entries);
      if (!incidentCatalogCode && entries.length > 0) {
        const defaultItem = entries.find((item) => item.applies_to === 'shipment' || item.applies_to === 'both') ?? entries[0];
        setIncidentCatalogCode(defaultItem.code);
        setIncidentCategory(defaultItem.category);
      }
    }).catch(() => setIncidentCatalog([]));
  }, []);

  const formatDate = (value: Date) => value.toISOString().slice(0, 10);
  const minScheduledAt = (() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return formatDate(date);
  })();
  const maxScheduledAt = (() => {
    const date = new Date();
    date.setDate(date.getDate() + 180);
    return formatDate(date);
  })();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(wizardStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<{ enabled: boolean; step: number }>;
      if (typeof parsed.enabled === 'boolean') setWizardMode(parsed.enabled);
      if (parsed.step === 1 || parsed.step === 2 || parsed.step === 3 || parsed.step === 4) {
        setWizardStep(parsed.step);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      wizardStorageKey,
      JSON.stringify({ enabled: wizardMode, step: wizardStep })
    );
  }, [wizardMode, wizardStep]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(shipmentTemplatesStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ShipmentQuickTemplate[];
      if (Array.isArray(parsed)) {
        setShipmentTemplates(parsed);
      }
    } catch {
      setShipmentTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(shipmentTemplatesStorageKey, JSON.stringify(shipmentTemplates));
  }, [shipmentTemplates]);

  const validateWizardStep = (step: 1 | 2 | 3 | 4): string | null => {
    if (step === 1) {
      if (!createHubId.trim()) return 'Selecciona hub en Paso 1.';
      if (!createScheduledAt.trim()) return 'Define fecha programada en Paso 1.';
      return null;
    }
    if (step === 2 && createOperation === 'shipment') {
      if (!createConsigneeDocumentId.trim()) return 'Documento destinatario obligatorio (Paso 2).';
      if (!hasRequiredRecipientName(createConsigneeDocType, createConsignee, createConsigneeFirstName, createConsigneeLastName)) {
        return createConsigneeDocType === 'CIF'
          ? 'Razon social destinatario obligatoria (Paso 2).'
          : 'Nombre y apellidos destinatario obligatorios (Paso 2).';
      }
      if (!createPhone.trim()) return 'Telefono destinatario obligatorio (Paso 2).';
      return null;
    }
    if (step === 3) {
      if (!createSenderDocumentId.trim()) return 'Documento remitente obligatorio (Paso 3).';
      if (!hasRequiredSenderName(createSenderDocType, createSenderLegalName, createSenderFirstName, createSenderLastName)) {
        return createSenderDocType === 'CIF'
          ? 'Razon social remitente obligatoria (Paso 3).'
          : 'Nombre y apellidos remitente obligatorios (Paso 3).';
      }
      if (!createSenderPhone.trim()) return 'Telefono remitente obligatorio (Paso 3).';
      return null;
    }
    return null;
  };

  const goPrevWizardStep = () => setWizardStep((value) => Math.max(1, value - 1) as 1 | 2 | 3 | 4);

  const goNextWizardStep = () => {
    const blockingError = validateWizardStep(wizardStep);
    if (blockingError) {
      setCreateError(blockingError);
      return;
    }
    setCreateError('');
    setWizardStep((value) => Math.min(4, value + 1) as 1 | 2 | 3 | 4);
  };

  const lookupRecipientContact = async (criteria: { phone?: string; document?: string }) => {
    const phone = criteria.phone?.trim() ?? '';
    const document = criteria.document?.trim() ?? '';
    if (!phone && !document) {
      setConsigneeLookupError('Introduce movil o documento para buscar.');
      return;
    }
    setConsigneeLookupError('');
    setConsigneeLookupLoading(true);
    try {
      const matches = await apiClient.getContacts({
        phone: phone || undefined,
        q: document || undefined,
        documentId: document || undefined,
        kind: 'recipient',
        limit: 20,
      });
      if (!matches.length) {
        setConsigneeLookupError('No se encontro destinatario con esos datos.');
      } else {
        const contact = matches[0];
        const docId = (contact.document_id ?? '').trim();
        const inferredDocType = inferDocumentType(docId, createConsigneeDocType);
        setCreateConsigneeDocType(inferredDocType);
        setCreateConsigneeDocumentId(docId);
        if (inferredDocType === 'CIF') {
          setCreateConsignee(contact.display_name ?? contact.legal_name ?? '');
          setCreateConsigneeFirstName('');
          setCreateConsigneeLastName('');
        } else {
          const fullName = (contact.display_name ?? '').trim();
          const parts = fullName.split(' ').filter(Boolean);
          setCreateConsigneeFirstName(parts.shift() ?? '');
          setCreateConsigneeLastName(parts.join(' '));
          setCreateConsignee('');
        }
        setCreatePhone(contact.phone ?? '');
        setCreateEmail(contact.email ?? '');
        setCreateStreet(contact.address_street ?? '');
        setCreateNumber(contact.address_number ?? '');
        setCreatePostalCode(contact.postal_code ?? '');
        setCreateCity(contact.city ?? '');
        setCreateProvince(contact.province ?? '');
        setCreateCountry(contact.country ?? 'ES');
        setCreateAddressNotes(contact.address_notes ?? '');
      }
    } catch (error) {
      setConsigneeLookupError(error instanceof Error ? error.message : 'No se pudo buscar el contacto');
    } finally {
      setConsigneeLookupLoading(false);
    }
  };

  const lookupSenderContact = async (criteria: { phone?: string; document?: string }) => {
    const phone = criteria.phone?.trim() ?? '';
    const document = criteria.document?.trim() ?? '';
    if (!phone && !document) {
      setSenderLookupError('Introduce movil o documento para buscar.');
      return;
    }
    setSenderLookupError('');
    setSenderLookupLoading(true);
    try {
      const matches = await apiClient.getContacts({
        phone: phone || undefined,
        q: document || undefined,
        documentId: document || undefined,
        kind: 'sender',
        limit: 20,
      });
      if (!matches.length) {
        setSenderLookupError('No se encontro remitente con esos datos.');
      } else {
        const contact = matches[0];
        const docId = (contact.document_id ?? '').trim();
        const inferredDocType = inferDocumentType(docId, createSenderDocType);
        setCreateSenderDocType(inferredDocType);
        setCreateSenderDocumentId(docId);
        if (inferredDocType === 'CIF') {
          setCreateSenderLegalName(contact.display_name ?? contact.legal_name ?? '');
          setCreateSenderFirstName('');
          setCreateSenderLastName('');
        } else {
          const fullName = (contact.display_name ?? '').trim();
          const parts = fullName.split(' ').filter(Boolean);
          setCreateSenderFirstName(parts.shift() ?? '');
          setCreateSenderLastName(parts.join(' '));
          setCreateSenderLegalName('');
        }
        setCreateSenderPhone(contact.phone ?? '');
        setCreateSenderEmail(contact.email ?? '');
        setCreateSenderStreet(contact.address_street ?? '');
        setCreateSenderNumber(contact.address_number ?? '');
        setCreateSenderPostalCode(contact.postal_code ?? '');
        setCreateSenderCity(contact.city ?? '');
        setCreateSenderProvince(contact.province ?? '');
        setCreateSenderCountry(contact.country ?? 'ES');
        setCreateSenderAddressNotes(contact.address_notes ?? '');
      }
    } catch (error) {
      setSenderLookupError(error instanceof Error ? error.message : 'No se pudo buscar el contacto');
    } finally {
      setSenderLookupLoading(false);
    }
  };

  const suggestRecipientAddresses = async () => {
    const q = [createStreet, createCity, createPostalCode, createPhone].join(' ').trim();
    if (!q) {
      setRecipientAddressSuggestions([]);
      return;
    }
    try {
      const rows = await apiClient.getAddressSuggestions({
        q,
        kind: 'recipient',
        city: createCity || undefined,
        postalCode: createPostalCode || undefined,
        limit: 10,
      });
      setRecipientAddressSuggestions(rows.map((item) => ({
        address_street: item.address_street,
        address_number: item.address_number,
        postal_code: item.postal_code,
        city: item.city,
        province: item.province,
        country: item.country,
        address_notes: item.address_notes,
      })));
    } catch {
      try {
        const rows = await apiClient.getContacts({ q, kind: 'recipient', limit: 25 });
        setRecipientAddressSuggestions(buildAddressSuggestions(rows, {
          street: createStreet,
          postalCode: createPostalCode,
          city: createCity,
          phone: createPhone,
          documentId: createConsigneeDocumentId,
        }));
      } catch {
        setRecipientAddressSuggestions([]);
      }
    }
  };

  const suggestSenderAddresses = async () => {
    const q = [createSenderStreet, createSenderCity, createSenderPostalCode, createSenderPhone].join(' ').trim();
    if (!q) {
      setSenderAddressSuggestions([]);
      return;
    }
    try {
      const rows = await apiClient.getAddressSuggestions({
        q,
        kind: 'sender',
        city: createSenderCity || undefined,
        postalCode: createSenderPostalCode || undefined,
        limit: 10,
      });
      setSenderAddressSuggestions(rows.map((item) => ({
        address_street: item.address_street,
        address_number: item.address_number,
        postal_code: item.postal_code,
        city: item.city,
        province: item.province,
        country: item.country,
        address_notes: item.address_notes,
      })));
    } catch {
      try {
        const rows = await apiClient.getContacts({ q, kind: 'sender', limit: 25 });
        setSenderAddressSuggestions(buildAddressSuggestions(rows, {
          street: createSenderStreet,
          postalCode: createSenderPostalCode,
          city: createSenderCity,
          phone: createSenderPhone,
          documentId: createSenderDocumentId,
        }));
      } catch {
        setSenderAddressSuggestions([]);
      }
    }
  };

  const createShipment = async () => {
    if (wizardMode && wizardStep !== 4) {
      setCreateError('Completa el asistente hasta el Paso 4 para crear.');
      return;
    }
    const nextErrors: {
      hub?: string;
      scheduledAt?: string;
      recipientDocument?: string;
      recipientName?: string;
      recipientPhone?: string;
      street?: string;
      city?: string;
      postalCode?: string;
      phone?: string;
      email?: string;
      senderPhone?: string;
      senderEmail?: string;
      senderStreet?: string;
      senderPostalCode?: string;
      senderCity?: string;
      senderDocument?: string;
      senderName?: string;
    } = {};
    const hasAddressFields = [createStreet, createNumber, createPostalCode, createCity, createProvince, createCountry].some(
      (value) => value.trim() !== ''
    );
    const hasSenderAddressFields = [createSenderStreet, createSenderNumber, createSenderPostalCode, createSenderCity, createSenderProvince, createSenderCountry].some(
      (value) => value.trim() !== ''
    );
    if (!createHubId) nextErrors.hub = 'Selecciona un hub.';
    if (!createScheduledAt.trim()) {
      nextErrors.scheduledAt = 'La fecha programada es obligatoria.';
    }
    if (createOperation === 'shipment') {
      if (!createConsigneeDocumentId.trim()) {
        nextErrors.recipientDocument = 'Documento destinatario obligatorio.';
      }
      if (!hasRequiredRecipientName(createConsigneeDocType, createConsignee, createConsigneeFirstName, createConsigneeLastName)) {
        if (createConsigneeDocType === 'CIF') {
          nextErrors.recipientName = 'Razon social destinatario obligatoria.';
        } else {
          nextErrors.recipientName = 'Nombre y apellidos destinatario obligatorios.';
        }
      }
      if (!createPhone.trim()) {
        nextErrors.recipientPhone = 'Telefono destinatario obligatorio.';
      }
      if (!createStreet.trim()) nextErrors.street = 'La calle del destinatario es obligatoria.';
      if (!createCity.trim()) nextErrors.city = 'La ciudad del destinatario es obligatoria.';
      if (!createPostalCode.trim()) nextErrors.postalCode = 'Codigo postal destinatario obligatorio.';
    }
    if (hasAddressFields) {
      if (!createStreet.trim()) nextErrors.street = 'La calle es obligatoria.';
      if (!createCity.trim()) nextErrors.city = 'La ciudad es obligatoria.';
    }
    if (hasSenderAddressFields) {
      if (!createSenderStreet.trim()) nextErrors.senderStreet = 'La calle del remitente es obligatoria.';
      if (!createSenderCity.trim()) nextErrors.senderCity = 'La ciudad del remitente es obligatoria.';
    }
    if (!isValidPostalCode(createCountry, createPostalCode)) {
      nextErrors.postalCode = 'Codigo postal invalido.';
    }
    if (!isValidPostalCode(createSenderCountry, createSenderPostalCode)) {
      nextErrors.senderPostalCode = 'Codigo postal remitente invalido.';
    }
    if (!isValidPhone(createPhone)) {
      nextErrors.phone = 'Telefono invalido.';
    }
    if (!isValidPhone(createSenderPhone)) {
      nextErrors.senderPhone = 'Telefono remitente invalido.';
    }
    if (!isValidEmail(createEmail)) {
      nextErrors.email = 'Email invalido.';
    }
    if (!isValidEmail(createSenderEmail)) {
      nextErrors.senderEmail = 'Email remitente invalido.';
    }
    if (!createSenderDocumentId.trim()) {
      nextErrors.senderDocument = 'Documento remitente obligatorio.';
    }
    if (createOperation !== 'shipment') {
      if (!createSenderPhone.trim()) {
        nextErrors.senderPhone = 'Telefono remitente obligatorio para recogidas.';
      }
      if (!createSenderStreet.trim()) {
        nextErrors.senderStreet = 'La calle del remitente es obligatoria para recogidas.';
      }
      if (!createSenderPostalCode.trim()) {
        nextErrors.senderPostalCode = 'Codigo postal remitente obligatorio para recogidas.';
      }
      if (!createSenderCity.trim()) {
        nextErrors.senderCity = 'La ciudad del remitente es obligatoria para recogidas.';
      }
    }
    if (!hasRequiredSenderName(createSenderDocType, createSenderLegalName, createSenderFirstName, createSenderLastName)) {
      if (createSenderDocType === 'CIF') {
        nextErrors.senderName = 'Razon social obligatoria.';
      } else {
        nextErrors.senderName = 'Nombre y apellidos obligatorios.';
      }
    }
    if (createScheduledAt) {
      const parsed = Date.parse(createScheduledAt);
      if (Number.isNaN(parsed)) nextErrors.scheduledAt = 'Fecha/hora no valida (usa ISO).';
      if (!Number.isNaN(parsed)) {
        const minDate = new Date(`${minScheduledAt}T00:00:00Z`);
        const maxDate = new Date(`${maxScheduledAt}T23:59:59Z`);
        if (parsed < minDate.getTime()) nextErrors.scheduledAt = `La fecha debe ser posterior a ${minScheduledAt}.`;
        if (parsed > maxDate.getTime()) nextErrors.scheduledAt = `La fecha debe ser anterior a ${maxScheduledAt}.`;
      }
    }
    setCreateFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCreateError('Revisa los campos marcados antes de crear el envio.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const addressLine = [createStreet, createNumber].filter((value) => value.trim() !== '').join(' ').trim();
      const locality = [createPostalCode, createCity].filter((value) => value.trim() !== '').join(' ').trim();
      const composedAddress = [addressLine, locality, createProvince, createCountry]
        .map((value) => value.trim())
        .filter((value) => value !== '')
        .join(', ');
      const senderAddressLine = [createSenderStreet, createSenderNumber].filter((value) => value.trim() !== '').join(' ').trim();
      const senderLocality = [createSenderPostalCode, createSenderCity].filter((value) => value.trim() !== '').join(' ').trim();
      const composedSenderAddress = [senderAddressLine, senderLocality, createSenderProvince, createSenderCountry]
        .map((value) => value.trim())
        .filter((value) => value !== '')
        .join(', ');
      const recipientName = createConsigneeDocType === 'CIF'
        ? createConsignee
        : [createConsigneeFirstName, createConsigneeLastName].filter((value) => value.trim() !== '').join(' ');
      const senderName = createSenderDocType === 'CIF'
        ? createSenderLegalName
        : [createSenderFirstName, createSenderLastName].filter((value) => value.trim() !== '').join(' ');
      if (createOperation === 'shipment') {
        await apiClient.createShipment({
          hub_id: createHubId,
          external_reference: createExternalReference || null,
          consignee_name: recipientName || null,
          consignee_document_id: createConsigneeDocumentId || null,
          address_line: composedAddress || null,
          address_street: createStreet || null,
          address_number: createNumber || null,
          postal_code: createPostalCode || null,
          city: createCity || null,
          province: createProvince || null,
          country: createCountry || null,
          address_notes: createAddressNotes || null,
          consignee_phone: createPhone || null,
          consignee_email: createEmail || null,
          sender_name: senderName || null,
          sender_legal_name: createSenderDocType === 'CIF' ? createSenderLegalName || null : null,
          sender_document_id: createSenderDocumentId || null,
          sender_phone: createSenderPhone || null,
          sender_email: createSenderEmail || null,
          sender_address_line: composedSenderAddress || null,
          sender_address_street: createSenderStreet || null,
          sender_address_number: createSenderNumber || null,
          sender_postal_code: createSenderPostalCode || null,
          sender_city: createSenderCity || null,
          sender_province: createSenderProvince || null,
          sender_country: createSenderCountry || null,
          sender_address_notes: createSenderAddressNotes || null,
          scheduled_at: createScheduledAt || null,
          service_type: createServiceType,
        });
      } else {
        await apiClient.createPickup({
          hub_id: createHubId,
          external_reference: createExternalReference || null,
          pickup_type: createOperation === 'pickup_return' ? 'RETURN' : 'NORMAL',
          requester_name: senderName || null,
          address_line: composedSenderAddress || null,
          scheduled_at: createScheduledAt || null,
        });
      }
      setCreateExternalReference('');
      setCreateConsignee('');
      setCreateConsigneeDocumentId('');
      setCreateConsigneeDocType('DNI');
      setCreateConsigneeFirstName('');
      setCreateConsigneeLastName('');
      setCreateStreet('');
      setCreateNumber('');
      setCreatePostalCode('');
      setCreateCity('');
      setCreateProvince('');
      setCreateCountry('ES');
      setCreateAddressNotes('');
      setCreatePhone('');
      setCreateEmail('');
      setCreateSenderLegalName('');
      setCreateSenderDocumentId('');
      setCreateSenderDocType('DNI');
      setCreateSenderFirstName('');
      setCreateSenderLastName('');
      setCreateSenderStreet('');
      setCreateSenderNumber('');
      setCreateSenderPostalCode('');
      setCreateSenderCity('');
      setCreateSenderProvince('');
      setCreateSenderCountry('ES');
      setCreateSenderAddressNotes('');
      setCreateSenderPhone('');
      setCreateSenderEmail('');
      setConsigneeLookupPhone('');
      setConsigneeLookupDocument('');
      setSenderLookupPhone('');
      setSenderLookupDocument('');
      setRecipientAddressSuggestions([]);
      setSenderAddressSuggestions([]);
      setCreateScheduledAt(new Date().toISOString().slice(0, 10));
      setCreateOperation('shipment');
      setCreateServiceType('express_1030');
      setCreateFieldErrors({});
      await reload(1);
    } catch (exception) {
      setCreateError(exception instanceof Error ? exception.message : 'No se pudo crear el envio');
    } finally {
      setCreating(false);
    }
  };

  const clearRecipient = () => {
    setCreateConsignee('');
    setCreateConsigneeDocumentId('');
    setCreateConsigneeDocType('DNI');
    setCreateConsigneeFirstName('');
    setCreateConsigneeLastName('');
    setCreateStreet('');
    setCreateNumber('');
    setCreatePostalCode('');
    setCreateCity('');
    setCreateProvince('');
    setCreateCountry('ES');
    setCreateAddressNotes('');
    setCreatePhone('');
    setCreateEmail('');
    setConsigneeLookupPhone('');
    setConsigneeLookupDocument('');
    setRecipientAddressSuggestions([]);
  };

  const clearSender = () => {
    setCreateSenderLegalName('');
    setCreateSenderDocumentId('');
    setCreateSenderDocType('DNI');
    setCreateSenderFirstName('');
    setCreateSenderLastName('');
    setCreateSenderStreet('');
    setCreateSenderNumber('');
    setCreateSenderPostalCode('');
    setCreateSenderCity('');
    setCreateSenderProvince('');
    setCreateSenderCountry('ES');
    setCreateSenderAddressNotes('');
    setCreateSenderPhone('');
    setCreateSenderEmail('');
    setSenderLookupPhone('');
    setSenderLookupDocument('');
    setSenderAddressSuggestions([]);
  };

  const openIncidentModal = (item: ShipmentSummary) => {
    setIncidentTarget(item);
    setIncidentNotes('');
    setIncidentError('');
    const defaultItem = availableIncidentCatalog[0] ?? incidentCatalog[0];
    if (defaultItem) {
      setIncidentCatalogCode(defaultItem.code);
      setIncidentCategory(defaultItem.category);
    }
    setIncidentModalOpen(true);
  };

  const submitIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!incidentTarget) return;
    if (!incidentCatalogCode) {
      setIncidentError('Selecciona un catalogo.');
      return;
    }
    setIncidentSubmitting(true);
    setIncidentError('');
    try {
      await apiClient.createIncident({
        incidentable_type: 'shipment',
        incidentable_id: incidentTarget.id,
        catalog_code: incidentCatalogCode,
        category: incidentCategory,
        notes: incidentNotes || undefined,
      });
      setIncidentModalOpen(false);
      setIncidentTarget(null);
      setIncidentNotes('');
      await reload(meta.page || 1);
    } catch (exception) {
      setIncidentError(exception instanceof Error ? exception.message : 'No se pudo registrar la incidencia');
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const markDelivered = async (item: ShipmentSummary) => {
    if (item.status === 'delivered') return;
    setActionLoadingId(item.id);
    setActionError('');
    try {
      const updated = await apiClient.markShipmentDelivered(item.id);
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)));
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : 'No se pudo marcar como entregado');
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleShipmentSelection = (shipmentId: string) => {
    setSelectedShipmentIds((current) => (
      current.includes(shipmentId)
        ? current.filter((id) => id !== shipmentId)
        : [...current, shipmentId]
    ));
  };

  const toggleSelectCurrentPage = () => {
    const pageIds = items.map((row) => row.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedShipmentIds.includes(id));
    if (allSelected) {
      setSelectedShipmentIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedShipmentIds((current) => Array.from(new Set([...current, ...pageIds])));
  };

  const applyBulkUpdate = async () => {
    setBulkError('');
    setBulkMessage('');
    if (!bulkApplyToFiltered && selectedShipmentIds.length === 0) {
      setBulkError('Selecciona al menos un envio o marca aplicar a filtrados.');
      return;
    }
    if (!bulkStatus && !bulkHubId && !bulkScheduledAt) {
      setBulkError('Selecciona al menos un cambio masivo (estado, hub o fecha).');
      return;
    }
    if (!bulkReason.trim()) {
      setBulkError('Indica un motivo para auditoria.');
      return;
    }
    setBulkUpdating(true);
    try {
      const response = await apiClient.bulkUpdateShipments({
        shipment_ids: bulkApplyToFiltered ? [] : selectedShipmentIds,
        apply_to_filtered: bulkApplyToFiltered,
        ...(bulkApplyToFiltered ? {
          filter_status: status || undefined,
          filter_hub_id: hubFilter || undefined,
          filter_q: query || undefined,
          filter_scheduled_from: scheduledFrom || undefined,
          filter_scheduled_to: scheduledTo || undefined,
        } : {}),
        ...(bulkStatus ? { status: bulkStatus as 'created' | 'out_for_delivery' | 'delivered' | 'incident' } : {}),
        ...(bulkHubId ? { hub_id: bulkHubId } : {}),
        ...(bulkScheduledAt ? { scheduled_at: bulkScheduledAt } : {}),
        reason: bulkReason.trim(),
      });
      setBulkMessage(`Actualizados ${response.meta.updated_count} envios.`);
      await reload(meta.page || 1);
      setSelectedShipmentIds([]);
      setBulkReason('');
    } catch (exception) {
      setBulkError(exception instanceof Error ? exception.message : 'No se pudo aplicar la actualizacion masiva');
    } finally {
      setBulkUpdating(false);
    }
  };

  const previewBulkUpdate = async () => {
    setBulkError('');
    setBulkMessage('');
    if (!bulkApplyToFiltered && selectedShipmentIds.length === 0) {
      setBulkError('Selecciona al menos un envio o marca aplicar a filtrados.');
      return;
    }
    if (!bulkStatus && !bulkHubId && !bulkScheduledAt) {
      setBulkError('Selecciona al menos un cambio masivo (estado, hub o fecha).');
      return;
    }
    setBulkPreviewing(true);
    try {
      const preview = await apiClient.previewBulkUpdateShipments({
        shipment_ids: bulkApplyToFiltered ? [] : selectedShipmentIds,
        apply_to_filtered: bulkApplyToFiltered,
        ...(bulkApplyToFiltered ? {
          filter_status: status || undefined,
          filter_hub_id: hubFilter || undefined,
          filter_q: query || undefined,
          filter_scheduled_from: scheduledFrom || undefined,
          filter_scheduled_to: scheduledTo || undefined,
        } : {}),
        ...(bulkStatus ? { status: bulkStatus as 'created' | 'out_for_delivery' | 'delivered' | 'incident' } : {}),
        ...(bulkHubId ? { hub_id: bulkHubId } : {}),
        ...(bulkScheduledAt ? { scheduled_at: bulkScheduledAt } : {}),
        reason: bulkReason.trim() || undefined,
      });
      setBulkPreviewCount(preview.target_count);
      setBulkPreviewSample(preview.sample.map((row) => ({
        id: row.id,
        reference: row.reference,
        status: row.status,
      })));
    } catch (exception) {
      setBulkError(exception instanceof Error ? exception.message : 'No se pudo previsualizar la actualización masiva');
    } finally {
      setBulkPreviewing(false);
    }
  };

  const setQuickRange = (range: 'today' | 'tomorrow' | 'next7' | 'clear') => {
    if (range === 'clear') {
      setScheduledFrom('');
      setScheduledTo('');
      return;
    }
    const today = new Date();
    const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
    if (range === 'today') {
      const day = toIsoDate(today);
      setScheduledFrom(day);
      setScheduledTo(day);
      return;
    }
    if (range === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const day = toIsoDate(tomorrow);
      setScheduledFrom(day);
      setScheduledTo(day);
      return;
    }
    const start = toIsoDate(today);
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    setScheduledFrom(start);
    setScheduledTo(toIsoDate(end));
  };

  const exportCsv = async () => {
    setExportError('');
    try {
      await apiClient.exportShipmentsCsv({
        status: status || undefined,
        q: query || undefined,
        scheduledFrom: scheduledFrom || undefined,
        scheduledTo: scheduledTo || undefined,
        sort: sortField,
        dir: sortDir,
        hubId: hubFilter || undefined,
        columns: exportColumns,
      });
    } catch (exception) {
      setExportError(exception instanceof Error ? exception.message : 'No se pudo exportar CSV');
    }
  };

  const exportPdf = async () => {
    setExportError('');
    try {
      await apiClient.exportShipmentsPdf({
        status: status || undefined,
        q: query || undefined,
        scheduledFrom: scheduledFrom || undefined,
        scheduledTo: scheduledTo || undefined,
        sort: sortField,
        dir: sortDir,
        hubId: hubFilter || undefined,
        columns: exportColumns,
      });
    } catch (exception) {
      setExportError(exception instanceof Error ? exception.message : 'No se pudo exportar PDF');
    }
  };

  const setSort = (field: 'created_at' | 'scheduled_at' | 'reference' | 'status') => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: 'created_at' | 'scheduled_at' | 'reference' | 'status') => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const clearFilters = () => {
    setStatus('');
    setHubFilter('');
    setQuery('');
    setScheduledFrom('');
    setScheduledTo('');
    setSortField('created_at');
    setSortDir('desc');
    setPerPage(10);
    setMeta((current) => ({ ...current, page: 1 }));
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const resetExportColumns = () => {
    setExportColumns(defaultExportColumns);
  };

  const toggleExportColumn = (column: string) => {
    setExportColumns((current) => (
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column]
    ));
  };

  const summarizeImportErrors = (rows: Array<{ status: string; errors?: string[] }>) => {
    const summary: Record<string, number> = {};
    rows.forEach((row) => {
      if (row.status !== 'error' || !row.errors?.length) return;
      row.errors.forEach((error) => {
        summary[error] = (summary[error] ?? 0) + 1;
      });
    });
    return summary;
  };

  const applyTemplate = (template: ShipmentQuickTemplate) => {
    setCreateOperation(template.operation);
    setCreateServiceType(template.serviceType);
    setCreateHubId(template.hubId);
    setCreatePointId(template.pointId);

    setCreateConsigneeDocType(template.recipientDocType);
    setCreateConsigneeDocumentId(template.recipientDocumentId);
    setCreateConsignee(template.recipientLegalName);
    setCreateConsigneeFirstName(template.recipientFirstName);
    setCreateConsigneeLastName(template.recipientLastName);
    setCreatePhone(template.recipientPhone);
    setCreateEmail(template.recipientEmail);
    setCreateStreet(template.recipientStreet);
    setCreateNumber(template.recipientNumber);
    setCreatePostalCode(template.recipientPostalCode);
    setCreateCity(template.recipientCity);
    setCreateProvince(template.recipientProvince);
    setCreateCountry(template.recipientCountry || 'ES');
    setCreateAddressNotes(template.recipientNotes);

    setCreateSenderDocType(template.senderDocType);
    setCreateSenderDocumentId(template.senderDocumentId);
    setCreateSenderLegalName(template.senderLegalName);
    setCreateSenderFirstName(template.senderFirstName);
    setCreateSenderLastName(template.senderLastName);
    setCreateSenderPhone(template.senderPhone);
    setCreateSenderEmail(template.senderEmail);
    setCreateSenderStreet(template.senderStreet);
    setCreateSenderNumber(template.senderNumber);
    setCreateSenderPostalCode(template.senderPostalCode);
    setCreateSenderCity(template.senderCity);
    setCreateSenderProvince(template.senderProvince);
    setCreateSenderCountry(template.senderCountry || 'ES');
    setCreateSenderAddressNotes(template.senderNotes);
    setCreateError('');
  };

  const saveCurrentAsTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) {
      setCreateError('Define nombre de plantilla antes de guardar.');
      return;
    }
    const template: ShipmentQuickTemplate = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      operation: createOperation,
      serviceType: createServiceType,
      hubId: createHubId,
      pointId: createPointId,
      recipientDocType: createConsigneeDocType,
      recipientDocumentId: createConsigneeDocumentId,
      recipientLegalName: createConsignee,
      recipientFirstName: createConsigneeFirstName,
      recipientLastName: createConsigneeLastName,
      recipientPhone: createPhone,
      recipientEmail: createEmail,
      recipientStreet: createStreet,
      recipientNumber: createNumber,
      recipientPostalCode: createPostalCode,
      recipientCity: createCity,
      recipientProvince: createProvince,
      recipientCountry: createCountry,
      recipientNotes: createAddressNotes,
      senderDocType: createSenderDocType,
      senderDocumentId: createSenderDocumentId,
      senderLegalName: createSenderLegalName,
      senderFirstName: createSenderFirstName,
      senderLastName: createSenderLastName,
      senderPhone: createSenderPhone,
      senderEmail: createSenderEmail,
      senderStreet: createSenderStreet,
      senderNumber: createSenderNumber,
      senderPostalCode: createSenderPostalCode,
      senderCity: createSenderCity,
      senderProvince: createSenderProvince,
      senderCountry: createSenderCountry,
      senderNotes: createSenderAddressNotes,
    };
    setShipmentTemplates((current) => [template, ...current.filter((item) => item.name !== name)].slice(0, 20));
    setSelectedTemplateId(template.id);
    setNewTemplateName('');
    setCreateError('');
  };

  const deleteSelectedTemplate = () => {
    if (!selectedTemplateId) return;
    setShipmentTemplates((current) => current.filter((item) => item.id !== selectedTemplateId));
    setSelectedTemplateId('');
  };

  const downloadImportTemplate = async () => {
    try {
      await apiClient.downloadShipmentsTemplate();
    } catch {
      const header = 'hub_code,external_reference,consignee_name,address_street,address_number,postal_code,city,province,country,address_notes,consignee_phone,consignee_email,scheduled_at,service_type';
      const sample = 'AGP-HUB-01,REF-CLIENTE-0009,Cliente Demo,Calle Larios,12,29001,Malaga,Malaga,ES,Portal azul,+34950111222,cliente@eco.local,2026-03-05,express_1030';
      const content = `${header}\n${sample}\n`;
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'shipments_import_template.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const runImport = async () => {
    if (!importFile) {
      setImportError('Selecciona un CSV para importar.');
      return;
    }
    setImportError('');
    setImportMessage('');
    setImportResult(null);
    setImportSummary(null);
    setImportJobId(null);
    setImportJob(null);
    setImporting(true);
    try {
      const result = await apiClient.importShipmentsCsv(importFile, { dryRun: importDryRun, async: importAsync });
      if ('job_dispatched' in result) {
        setImportJobId(result.import_id);
        setImportMessage(`Importacion en cola: ${result.import_id}`);
      } else {
        setImportResult(result);
        setImportSummary(summarizeImportErrors(result.rows));
        if (result.import_id) {
          setImportJobId(result.import_id);
        }
      }
    } catch (exception) {
      setImportError(exception instanceof Error ? exception.message : 'No se pudo importar');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Crear Envio</CardTitle>
          <div className="page-subtitle">Operación, contactos y programación en un flujo rápido.</div>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <label htmlFor="shipment-template-select">Plantilla rapida</label>
            <select
              id="shipment-template-select"
              value={selectedTemplateId}
              onChange={(event) => {
                const templateId = event.target.value;
                setSelectedTemplateId(templateId);
                const template = shipmentTemplates.find((item) => item.id === templateId);
                if (template) applyTemplate(template);
              }}
            >
              <option value="">Seleccionar plantilla</option>
              {shipmentTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <input
              value={newTemplateName}
              onChange={(event) => setNewTemplateName(event.target.value)}
              placeholder="Nombre nueva plantilla"
            />
            <Button type="button" variant="outline" onClick={saveCurrentAsTemplate}>
              Guardar plantilla
            </Button>
            <Button type="button" variant="outline" onClick={deleteSelectedTemplate} disabled={!selectedTemplateId}>
              Eliminar plantilla
            </Button>
          </div>
          <div className="inline-actions">
            <label htmlFor="shipment-wizard-mode">Asistente paso a paso (beta)</label>
            <input
              id="shipment-wizard-mode"
              type="checkbox"
              checked={wizardMode}
              onChange={(event) => setWizardMode(event.target.checked)}
            />
            {wizardMode ? (
              <>
                <Button type="button" variant="outline" onClick={goPrevWizardStep}>
                  Paso anterior
                </Button>
                <Button type="button" variant="outline" onClick={goNextWizardStep}>
                  Siguiente paso
                </Button>
                <span className="helper">Paso {wizardStep}/4</span>
              </>
            ) : null}
          </div>
          {wizardMode ? (
            <div className="helper">
              {wizardStep === 1 ? 'Paso 1: define hub, operación y fecha.'
                : wizardStep === 2 ? 'Paso 2: completa destinatario.'
                : wizardStep === 3 ? 'Paso 3: completa remitente.'
                : 'Paso 4: revisa y crea envío/recogida.'}
            </div>
          ) : null}
          {!wizardMode || wizardStep === 1 ? (
          <div className="form-row">
            <div>
              <label htmlFor="create-shipment-hub">Hub</label>
              <select id="create-shipment-hub" value={createHubId} onChange={(event) => setCreateHubId(event.target.value)}>
                <option value="">Selecciona hub</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>{hub.code} - {hub.name}</option>
                ))}
              </select>
              {createFieldErrors.hub ? <div className="helper error">{createFieldErrors.hub}</div> : null}
            </div>
            <div>
              <label htmlFor="create-shipment-point">Punto operativo (opcional)</label>
              <select
                id="create-shipment-point"
                value={createPointId}
                onChange={(event) => setCreatePointId(event.target.value)}
              >
                <option value="">Sin punto</option>
                {hubPoints.map((point) => {
                  const depotCode = point.depot_id ? (hubDepots.find((item) => item.id === point.depot_id)?.code ?? point.depot_id) : null;
                  return (
                    <option key={point.id} value={point.id}>
                      {point.code} - {point.name}{depotCode ? ` (${depotCode})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label htmlFor="create-shipment-external-ref">Referencia cliente</label>
              <input
                id="create-shipment-external-ref"
                value={createExternalReference}
                onChange={(event) => setCreateExternalReference(event.target.value)}
                placeholder="Ej: REF-ACME-2026-0001"
              />
            </div>
            <div>
              <label htmlFor="create-shipment-operation">Operacion</label>
              <select
                id="create-shipment-operation"
                value={createOperation}
                onChange={(event) => setCreateOperation(event.target.value as 'shipment' | 'pickup_normal' | 'pickup_return')}
              >
                <option value="shipment">Envio</option>
                <option value="pickup_normal">Recogida</option>
                <option value="pickup_return">Devolucion</option>
              </select>
            </div>
            {createOperation === 'shipment' ? (
              <div>
                <label htmlFor="create-shipment-service">Tipo de envio</label>
                <select
                  id="create-shipment-service"
                  value={createServiceType}
                  onChange={(event) => setCreateServiceType(event.target.value as typeof createServiceType)}
                >
                  <option value="express_1030">Express 10:30</option>
                  <option value="express_1400">Express 14:00</option>
                  <option value="express_1900">Express 19:00</option>
                  <option value="economy_parcel">Economy Parcel</option>
                  <option value="business_parcel">Business Parcel</option>
                  <option value="thermo_parcel">Thermo Parcel</option>
                </select>
              </div>
            ) : null}
            <div>
              <label htmlFor="create-shipment-scheduled">Fecha programada</label>
              <input
                id="create-shipment-scheduled"
                type="date"
                value={createScheduledAt}
                onChange={(event) => setCreateScheduledAt(event.target.value)}
                min={minScheduledAt}
                max={maxScheduledAt}
              />
              <div className="helper">Ventana: {minScheduledAt} a {maxScheduledAt}</div>
              {createFieldErrors.scheduledAt ? <div className="helper error">{createFieldErrors.scheduledAt}</div> : null}
            </div>
          </div>
          ) : null}

          {(!wizardMode || wizardStep === 2 || wizardStep === 3 || wizardStep === 4) ? (
            <div className="page-grid two">
              {!wizardMode || wizardStep === 2 || wizardStep === 4 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Destinatario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="helper">
                      {createConsigneeDocType === 'CIF'
                        ? (createConsignee || 'Sin destinatario')
                        : ([createConsigneeFirstName, createConsigneeLastName].filter((value) => value.trim() !== '').join(' ') || 'Sin destinatario')}
                    </div>
                    <div className="helper">{createPhone || '-'}</div>
                    <div className="helper">{createStreet || ''} {createNumber || ''} {createCity || ''}</div>
                    <div className="inline-actions">
                      <Button type="button" variant="outline" onClick={() => setRecipientModalOpen(true)}>
                        Editar destinatario
                      </Button>
                      <Button type="button" variant="outline" onClick={clearRecipient}>
                        Limpiar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
              {!wizardMode || wizardStep === 3 || wizardStep === 4 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Remitente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="helper">
                      {createSenderDocType === 'CIF'
                        ? (createSenderLegalName || 'Sin remitente')
                        : ([createSenderFirstName, createSenderLastName].filter((value) => value.trim() !== '').join(' ') || 'Sin remitente')}
                    </div>
                    <div className="helper">{createSenderPhone || '-'}</div>
                    <div className="helper">{createSenderStreet || ''} {createSenderNumber || ''} {createSenderCity || ''}</div>
                    <div className="inline-actions">
                      <Button type="button" variant="outline" onClick={() => setSenderModalOpen(true)}>
                        Editar remitente
                      </Button>
                      <Button type="button" variant="outline" onClick={clearSender}>
                        Limpiar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {!wizardMode || wizardStep === 4 ? (
          <div className="inline-actions">
            <Button type="button" onClick={createShipment} disabled={creating}>
              {creating ? 'Creando...' : createOperation === 'shipment' ? 'Crear envio' : 'Crear recogida'}
            </Button>
          </div>
          ) : null}
          {createError ? <div className="helper">{createError}</div> : null}
        </CardContent>
      </Card>
      <Modal
        open={recipientModalOpen}
        onClose={() => setRecipientModalOpen(false)}
        title="Destinatario"
        footer={
          <Button type="button" onClick={() => setRecipientModalOpen(false)}>
            Guardar
          </Button>
        }
      >
        <div className="form-row">
          <label htmlFor="create-shipment-consignee-lookup">Buscar por movil</label>
          <input
            id="create-shipment-consignee-lookup"
            value={consigneeLookupPhone}
            onChange={(event) => setConsigneeLookupPhone(event.target.value)}
            placeholder="+34 600 000 000"
          />
          <label htmlFor="create-shipment-consignee-lookup-document">Buscar por documento</label>
          <input
            id="create-shipment-consignee-lookup-document"
            value={consigneeLookupDocument}
            onChange={(event) => setConsigneeLookupDocument(event.target.value)}
            placeholder="DNI/NIE/CIF/Pasaporte"
          />
          <Button
            type="button"
            variant="outline"
            disabled={consigneeLookupLoading}
            onClick={() => void lookupRecipientContact({ phone: consigneeLookupPhone, document: consigneeLookupDocument })}
          >
            {consigneeLookupLoading ? 'Buscando...' : 'Buscar'}
          </Button>
          {consigneeLookupError ? <div className="helper error">{consigneeLookupError}</div> : null}
        </div>
        <div className="form-row">
          <label htmlFor="create-shipment-consignee-doc-type">Tipo documento</label>
          <select
            id="create-shipment-consignee-doc-type"
            value={createConsigneeDocType}
            onChange={(event) => setCreateConsigneeDocType(event.target.value as typeof createConsigneeDocType)}
          >
            <option value="DNI">DNI</option>
            <option value="NIE">NIE</option>
            <option value="PASSPORT">Pasaporte</option>
            <option value="CIF">CIF</option>
          </select>
          <label htmlFor="create-shipment-consignee-document">Documento</label>
          <input
            id="create-shipment-consignee-document"
            value={createConsigneeDocumentId}
            onChange={(event) => {
              const value = event.target.value;
              setCreateConsigneeDocumentId(value);
              setCreateConsigneeDocType(inferDocumentType(value, createConsigneeDocType));
            }}
            placeholder="DNI/CIF"
          />
          {createFieldErrors.recipientDocument ? <div className="helper error">{createFieldErrors.recipientDocument}</div> : null}
          {createConsigneeDocType === 'CIF' ? (
            <>
              <label htmlFor="create-shipment-consignee-legal-name">Razon social</label>
              <input
                id="create-shipment-consignee-legal-name"
                value={createConsignee}
                onChange={(event) => setCreateConsignee(event.target.value)}
                placeholder="Razon social"
              />
            </>
          ) : (
            <>
              <label htmlFor="create-shipment-consignee-first">Nombre</label>
              <input
                id="create-shipment-consignee-first"
                value={createConsigneeFirstName}
                onChange={(event) => setCreateConsigneeFirstName(event.target.value)}
                placeholder="Nombre"
              />
              <label htmlFor="create-shipment-consignee-last">Apellidos</label>
              <input
                id="create-shipment-consignee-last"
                value={createConsigneeLastName}
                onChange={(event) => setCreateConsigneeLastName(event.target.value)}
                placeholder="Apellidos"
              />
            </>
          )}
          {createFieldErrors.recipientName ? <div className="helper error">{createFieldErrors.recipientName}</div> : null}
          <label htmlFor="create-shipment-phone">Telefono</label>
          <input
            id="create-shipment-phone"
            value={createPhone}
            onChange={(event) => setCreatePhone(event.target.value)}
            placeholder="+34 950 111 222"
          />
          {createFieldErrors.recipientPhone ? <div className="helper error">{createFieldErrors.recipientPhone}</div> : null}
          {createFieldErrors.phone ? <div className="helper error">{createFieldErrors.phone}</div> : null}
          <label htmlFor="create-shipment-email">Email</label>
          <input
            id="create-shipment-email"
            value={createEmail}
            onChange={(event) => setCreateEmail(event.target.value)}
            placeholder="cliente@eco.local"
          />
          {createFieldErrors.email ? <div className="helper error">{createFieldErrors.email}</div> : null}
        </div>
        <div className="form-row">
          <label htmlFor="create-shipment-street">Calle</label>
          <input
            id="create-shipment-street"
            value={createStreet}
            onChange={(event) => setCreateStreet(event.target.value)}
            placeholder="Calle y via"
          />
          {createFieldErrors.street ? <div className="helper error">{createFieldErrors.street}</div> : null}
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => void suggestRecipientAddresses()}>
              Sugerir direccion
            </Button>
            {recipientAddressSuggestions.map((suggestion, index) => (
              <Button
                key={`recipient-address-${index}`}
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateStreet(suggestion.address_street ?? '');
                  setCreateNumber(suggestion.address_number ?? '');
                  setCreatePostalCode(suggestion.postal_code ?? '');
                  setCreateCity(suggestion.city ?? '');
                  setCreateProvince(suggestion.province ?? '');
                  setCreateCountry(suggestion.country ?? 'ES');
                  setCreateAddressNotes(suggestion.address_notes ?? '');
                }}
              >
                {(suggestion.address_street ?? '').trim() || '-'} {(suggestion.address_number ?? '').trim()} · {(suggestion.postal_code ?? '').trim()} {(suggestion.city ?? '').trim()}
              </Button>
            ))}
          </div>
          <label htmlFor="create-shipment-number">Numero</label>
          <input
            id="create-shipment-number"
            value={createNumber}
            onChange={(event) => setCreateNumber(event.target.value)}
            placeholder="Portal, piso"
          />
          <label htmlFor="create-shipment-postal">Codigo postal</label>
          <input
            id="create-shipment-postal"
            value={createPostalCode}
            onChange={(event) => setCreatePostalCode(event.target.value)}
            placeholder="29001"
          />
          {createFieldErrors.postalCode ? <div className="helper error">{createFieldErrors.postalCode}</div> : null}
          <label htmlFor="create-shipment-city">Ciudad</label>
          <input
            id="create-shipment-city"
            value={createCity}
            onChange={(event) => setCreateCity(event.target.value)}
            placeholder="Malaga"
          />
          {createFieldErrors.city ? <div className="helper error">{createFieldErrors.city}</div> : null}
          <label htmlFor="create-shipment-province">Provincia</label>
          <input
            id="create-shipment-province"
            value={createProvince}
            onChange={(event) => setCreateProvince(event.target.value)}
            placeholder="Malaga"
          />
          <label htmlFor="create-shipment-country">Pais</label>
          <input
            id="create-shipment-country"
            value={createCountry}
            onChange={(event) => setCreateCountry(event.target.value)}
            placeholder="ES"
          />
          <label htmlFor="create-shipment-notes">Notas direccion</label>
          <input
            id="create-shipment-notes"
            value={createAddressNotes}
            onChange={(event) => setCreateAddressNotes(event.target.value)}
            placeholder="Puerta, horario, contacto"
          />
        </div>
      </Modal>
      <Modal
        open={senderModalOpen}
        onClose={() => setSenderModalOpen(false)}
        title="Remitente"
        footer={
          <Button type="button" onClick={() => setSenderModalOpen(false)}>
            Guardar
          </Button>
        }
      >
        <div className="form-row">
          <label htmlFor="create-sender-lookup">Buscar por movil</label>
          <input
            id="create-sender-lookup"
            value={senderLookupPhone}
            onChange={(event) => setSenderLookupPhone(event.target.value)}
            placeholder="+34 600 000 000"
          />
          <label htmlFor="create-sender-lookup-document">Buscar por documento</label>
          <input
            id="create-sender-lookup-document"
            value={senderLookupDocument}
            onChange={(event) => setSenderLookupDocument(event.target.value)}
            placeholder="DNI/NIE/CIF/Pasaporte"
          />
          <Button
            type="button"
            variant="outline"
            disabled={senderLookupLoading}
            onClick={() => void lookupSenderContact({ phone: senderLookupPhone, document: senderLookupDocument })}
          >
            {senderLookupLoading ? 'Buscando...' : 'Buscar'}
          </Button>
          {senderLookupError ? <div className="helper error">{senderLookupError}</div> : null}
        </div>
        <div className="form-row">
          <label htmlFor="create-sender-doc-type">Tipo documento</label>
          <select
            id="create-sender-doc-type"
            value={createSenderDocType}
            onChange={(event) => setCreateSenderDocType(event.target.value as typeof createSenderDocType)}
          >
            <option value="DNI">DNI</option>
            <option value="NIE">NIE</option>
            <option value="PASSPORT">Pasaporte</option>
            <option value="CIF">CIF</option>
          </select>
          <label htmlFor="create-sender-document">Documento</label>
          <input
            id="create-sender-document"
            value={createSenderDocumentId}
            onChange={(event) => {
              const value = event.target.value;
              setCreateSenderDocumentId(value);
              setCreateSenderDocType(inferDocumentType(value, createSenderDocType));
            }}
            placeholder="DNI/CIF"
          />
          {createFieldErrors.senderDocument ? <div className="helper error">{createFieldErrors.senderDocument}</div> : null}
          {createSenderDocType === 'CIF' ? (
            <>
              <label htmlFor="create-sender-legal-name">Razon social</label>
              <input
                id="create-sender-legal-name"
                value={createSenderLegalName}
                onChange={(event) => setCreateSenderLegalName(event.target.value)}
                placeholder="Razon social"
              />
            </>
          ) : (
            <>
              <label htmlFor="create-sender-first-name">Nombre</label>
              <input
                id="create-sender-first-name"
                value={createSenderFirstName}
                onChange={(event) => setCreateSenderFirstName(event.target.value)}
                placeholder="Nombre"
              />
              <label htmlFor="create-sender-last-name">Apellidos</label>
              <input
                id="create-sender-last-name"
                value={createSenderLastName}
                onChange={(event) => setCreateSenderLastName(event.target.value)}
                placeholder="Apellidos"
              />
            </>
          )}
          {createFieldErrors.senderName ? <div className="helper error">{createFieldErrors.senderName}</div> : null}
          <label htmlFor="create-sender-phone">Telefono</label>
          <input
            id="create-sender-phone"
            value={createSenderPhone}
            onChange={(event) => setCreateSenderPhone(event.target.value)}
            placeholder="+34 600 111 222"
          />
          {createFieldErrors.senderPhone ? <div className="helper error">{createFieldErrors.senderPhone}</div> : null}
          <label htmlFor="create-sender-email">Email</label>
          <input
            id="create-sender-email"
            value={createSenderEmail}
            onChange={(event) => setCreateSenderEmail(event.target.value)}
            placeholder="remitente@eco.local"
          />
          {createFieldErrors.senderEmail ? <div className="helper error">{createFieldErrors.senderEmail}</div> : null}
        </div>
        <div className="form-row">
          <label htmlFor="create-sender-street">Calle</label>
          <input
            id="create-sender-street"
            value={createSenderStreet}
            onChange={(event) => setCreateSenderStreet(event.target.value)}
            placeholder="Calle y via"
          />
          {createFieldErrors.senderStreet ? <div className="helper error">{createFieldErrors.senderStreet}</div> : null}
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => void suggestSenderAddresses()}>
              Sugerir direccion
            </Button>
            {senderAddressSuggestions.map((suggestion, index) => (
              <Button
                key={`sender-address-${index}`}
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateSenderStreet(suggestion.address_street ?? '');
                  setCreateSenderNumber(suggestion.address_number ?? '');
                  setCreateSenderPostalCode(suggestion.postal_code ?? '');
                  setCreateSenderCity(suggestion.city ?? '');
                  setCreateSenderProvince(suggestion.province ?? '');
                  setCreateSenderCountry(suggestion.country ?? 'ES');
                  setCreateSenderAddressNotes(suggestion.address_notes ?? '');
                }}
              >
                {(suggestion.address_street ?? '').trim() || '-'} {(suggestion.address_number ?? '').trim()} · {(suggestion.postal_code ?? '').trim()} {(suggestion.city ?? '').trim()}
              </Button>
            ))}
          </div>
          <label htmlFor="create-sender-number">Numero</label>
          <input
            id="create-sender-number"
            value={createSenderNumber}
            onChange={(event) => setCreateSenderNumber(event.target.value)}
            placeholder="Portal, piso"
          />
          <label htmlFor="create-sender-postal">Codigo postal</label>
          <input
            id="create-sender-postal"
            value={createSenderPostalCode}
            onChange={(event) => setCreateSenderPostalCode(event.target.value)}
            placeholder="29001"
          />
          {createFieldErrors.senderPostalCode ? <div className="helper error">{createFieldErrors.senderPostalCode}</div> : null}
          <label htmlFor="create-sender-city">Ciudad</label>
          <input
            id="create-sender-city"
            value={createSenderCity}
            onChange={(event) => setCreateSenderCity(event.target.value)}
            placeholder="Malaga"
          />
          {createFieldErrors.senderCity ? <div className="helper error">{createFieldErrors.senderCity}</div> : null}
          <label htmlFor="create-sender-province">Provincia</label>
          <input
            id="create-sender-province"
            value={createSenderProvince}
            onChange={(event) => setCreateSenderProvince(event.target.value)}
            placeholder="Malaga"
          />
          <label htmlFor="create-sender-country">Pais</label>
          <input
            id="create-sender-country"
            value={createSenderCountry}
            onChange={(event) => setCreateSenderCountry(event.target.value)}
            placeholder="ES"
          />
          <label htmlFor="create-sender-notes">Notas</label>
          <input
            id="create-sender-notes"
            value={createSenderAddressNotes}
            onChange={(event) => setCreateSenderAddressNotes(event.target.value)}
            placeholder="Observaciones remitente"
          />
        </div>
      </Modal>
      <Modal
        open={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        title="Registrar incidencia"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIncidentModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="shipment-incident-form" disabled={incidentSubmitting}>
              {incidentSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="shipment-incident-form" className="page-grid" onSubmit={submitIncident}>
          <div className="form-row">
            <div>
              <label>Envio</label>
              <input value={incidentTarget?.reference ?? ''} readOnly />
            </div>
            <div>
              <label>Destinatario</label>
              <input value={incidentTarget?.consignee_name ?? ''} readOnly />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="shipment-incident-catalog">Catalogo</label>
            <select
              id="shipment-incident-catalog"
              value={incidentCatalogCode}
              onChange={(event) => {
                const code = event.target.value;
                setIncidentCatalogCode(code);
                const selected = availableIncidentCatalog.find((item) => item.code === code);
                if (selected) setIncidentCategory(selected.category);
              }}
            >
              {availableIncidentCatalog.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
            <label>Categoria</label>
            <input value={incidentCategory} readOnly />
          </div>
          <div className="form-row">
            <label htmlFor="shipment-incident-notes">Notas</label>
            <input
              id="shipment-incident-notes"
              value={incidentNotes}
              onChange={(event) => setIncidentNotes(event.target.value)}
              placeholder="Detalles operativos"
            />
          </div>
          {incidentError ? <div className="helper error">{incidentError}</div> : null}
        </form>
      </Modal>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Envios</CardTitle>
          <div className="page-subtitle">Listado operativo con filtros rápidos y exportación.</div>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Total</div>
              <div className="kpi-value">{shipmentSummary.total}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">En página</div>
              <div className="kpi-value">{shipmentSummary.pageCount}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Created</div>
              <div className="kpi-value">{shipmentSummary.created}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Out</div>
              <div className="kpi-value">{shipmentSummary.out}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Delivered</div>
              <div className="kpi-value">{shipmentSummary.delivered}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Incident</div>
              <div className="kpi-value">{shipmentSummary.incident}</div>
            </div>
          </div>
          <div className="inline-actions">
            <span className="helper">Seleccionados: {selectedShipmentIds.length}</span>
            <label htmlFor="bulk-filtered">
              <input
                id="bulk-filtered"
                type="checkbox"
                checked={bulkApplyToFiltered}
                onChange={(event) => setBulkApplyToFiltered(event.target.checked)}
              />
              {' '}Aplicar a filtrados
            </label>
            <label htmlFor="bulk-status">Estado</label>
            <select id="bulk-status" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
              <option value="">Sin cambio</option>
              <option value="created">created</option>
              <option value="out_for_delivery">out_for_delivery</option>
              <option value="delivered">delivered</option>
              <option value="incident">incident</option>
            </select>
            <label htmlFor="bulk-hub">Hub</label>
            <select id="bulk-hub" value={bulkHubId} onChange={(event) => setBulkHubId(event.target.value)}>
              <option value="">Sin cambio</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.code}</option>
              ))}
            </select>
            <label htmlFor="bulk-scheduled">Fecha</label>
            <input id="bulk-scheduled" type="date" value={bulkScheduledAt} onChange={(event) => setBulkScheduledAt(event.target.value)} />
            <label htmlFor="bulk-reason">Motivo</label>
            <input
              id="bulk-reason"
              value={bulkReason}
              onChange={(event) => setBulkReason(event.target.value)}
              placeholder="Ej: Replanificacion operativa"
            />
            <Button type="button" onClick={applyBulkUpdate} disabled={bulkUpdating}>
              {bulkUpdating ? 'Aplicando...' : 'Aplicar masivo'}
            </Button>
            <Button type="button" variant="outline" onClick={previewBulkUpdate} disabled={bulkPreviewing}>
              {bulkPreviewing ? 'Previsualizando...' : 'Previsualizar'}
            </Button>
          </div>
          <div className="helper">
            Impacto estimado: {bulkTargetCount} envio(s) {bulkApplyToFiltered ? 'del filtro actual' : 'seleccionado(s)'}.
          </div>
          {bulkPreviewCount !== null ? (
            <div className="helper">
              Preview backend: {bulkPreviewCount} objetivo(s). Muestra: {bulkPreviewSample.map((row) => `${row.reference}(${row.status})`).join(', ') || '-'}.
            </div>
          ) : null}
          {bulkError ? <div className="helper error">{bulkError}</div> : null}
          {bulkMessage ? <div className="helper">{bulkMessage}</div> : null}
          {actionError ? <div className="helper error">{actionError}</div> : null}
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((row) => selectedShipmentIds.includes(row.id))}
                      onChange={toggleSelectCurrentPage}
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className={`btn btn-outline ${sortField === 'reference' ? 'btn-sort-active' : ''}`}
                      onClick={() => setSort('reference')}
                    >
                      Referencia {sortIndicator('reference')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className={`btn btn-outline ${sortField === 'status' ? 'btn-sort-active' : ''}`}
                      onClick={() => setSort('status')}
                    >
                      Estado {sortIndicator('status')}
                    </button>
                  </TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Direccion</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className={`btn btn-outline ${sortField === 'scheduled_at' ? 'btn-sort-active' : ''}`}
                      onClick={() => setSort('scheduled_at')}
                    >
                      Programado {sortIndicator('scheduled_at')}
                    </button>
                  </TableHead>
                  <TableHead>Hub</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedShipmentIds.includes(item.id)}
                        onChange={() => toggleShipmentSelection(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <Link to={`/shipments/${item.id}`}>{item.reference}</Link>
                      </div>
                      {item.external_reference ? <div className="helper">Ext: {item.external_reference}</div> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={shipmentVariant(item.status)} title={shipmentStatusHelp(item.status)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell title={item.service_type ?? ''}>
                      {serviceTypeLabel(item.service_type)}
                    </TableCell>
                    <TableCell>{item.consignee_name ?? '-'}</TableCell>
                    <TableCell>{item.address_line ?? '-'}</TableCell>
                    <TableCell>{item.scheduled_at ?? '-'}</TableCell>
                    <TableCell>{item.hub_code ?? item.hub_id ?? '-'}</TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => markDelivered(item)}
                          disabled={item.status === 'delivered' || actionLoadingId === item.id}
                        >
                          {actionLoadingId === item.id ? 'Marcando...' : 'Marcar entregado'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => openIncidentModal(item)}>
                          Incidencia
                        </Button>
                        <Link to={`/shipments/${item.id}`} className="btn btn-outline">
                          Ver
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>Sin envíos para los filtros seleccionados.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant={showFilters ? 'secondary' : 'outline'} onClick={() => setShowFilters((value) => !value)}>
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </Button>
            <span className="helper">Filtros activos: {activeFiltersCount}</span>
            {activeFiltersCount > 0 ? (
              <Button type="button" variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
            ) : null}
          </div>
          {showFilters ? (
            <ShipmentFilters
              query={query}
              setQuery={setQuery}
              status={status}
              setStatus={setStatus}
              hubFilter={hubFilter}
              setHubFilter={setHubFilter}
              scheduledFrom={scheduledFrom}
              setScheduledFrom={setScheduledFrom}
              scheduledTo={scheduledTo}
              setScheduledTo={setScheduledTo}
              hubs={hubs}
              setQuickRange={setQuickRange}
              clearFilters={clearFilters}
              canExport={canExport}
              exportCsv={exportCsv}
              exportPdf={exportPdf}
            />
          ) : null}
          <div className="inline-actions">
            <span className="helper">Columnas export</span>
          {[
            'reference',
            'external_reference',
            'status',
            'service_type',
            'consignee_name',
            'address_street',
            'address_number',
            'postal_code',
            'city',
            'province',
            'country',
            'scheduled_at',
            'delivered_at',
            'hub_code',
          ].map((column) => (
              <label key={column}>
                <input
                  type="checkbox"
                  checked={exportColumns.includes(column)}
                  onChange={() => toggleExportColumn(column)}
                  disabled={!canExport}
                />
                {column}
              </label>
            ))}
            <Button type="button" variant="outline" onClick={resetExportColumns} disabled={!canExport}>
              Reset columnas
            </Button>
          </div>
          {exportError ? <div className="helper error">{exportError}</div> : null}
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => reload(Math.max(1, meta.page - 1))} disabled={meta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {meta.page} / {Math.max(1, meta.last_page || 1)}</span>
            <label htmlFor="shipments-per-page">Por pagina</label>
            <select
              id="shipments-per-page"
              value={perPage}
              onChange={(event) => setPerPage(Number(event.target.value))}
            >
              {[10, 25, 50].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => reload(meta.page + 1)}
              disabled={meta.page >= meta.last_page}
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
      {canImport ? (
        <Card>
          <CardHeader>
            <CardTitle className="page-title">Importar CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-actions">
              <input
                type="file"
                accept=".csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
            <label>
              <input
                type="checkbox"
                checked={importDryRun}
                onChange={(event) => setImportDryRun(event.target.checked)}
                disabled={importAsync}
              />
              Dry run
            </label>
            <label>
              <input
                type="checkbox"
                checked={importAsync}
                onChange={(event) => {
                  const next = event.target.checked;
                  setImportAsync(next);
                  if (next) setImportDryRun(false);
                }}
              />
              Async
            </label>
            <Button type="button" onClick={runImport} disabled={importing}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void downloadImportTemplate()}>
              Descargar plantilla
            </Button>
            </div>
          {importError ? <div className="helper error">{importError}</div> : null}
          {importMessage ? <div className="helper">{importMessage}</div> : null}
          {importJob ? (
            <div className="kpi-grid">
              <div>
                <div className="helper">Import ID</div>
                <div>{importJob.id}</div>
              </div>
              <div>
                <div className="helper">Estado</div>
                <div>{importJob.status}</div>
              </div>
              <div>
                <div className="helper">Creados</div>
                <div>{importJob.created_count}</div>
              </div>
              <div>
                <div className="helper">Errores</div>
                <div>{importJob.error_count}</div>
              </div>
              {importJob.error_message ? (
                <div>
                  <div className="helper">Error</div>
                  <div>{importJob.error_message}</div>
                </div>
              ) : null}
            </div>
          ) : null}
          {importResult ? (
            <div className="kpi-grid">
              <div>
                <div className="helper">Dry run</div>
                  <div>{importResult.dry_run ? 'si' : 'no'}</div>
                </div>
                <div>
                  <div className="helper">Creados</div>
                  <div>{importResult.created_count}</div>
                </div>
                <div>
                  <div className="helper">Errores</div>
                  <div>{importResult.error_count}</div>
                </div>
              {importSummary ? Object.entries(importSummary).map(([reason, count]) => (
                <div key={reason}>
                  <div className="helper">{reason}</div>
                  <div>{count}</div>
                </div>
              )) : null}
            </div>
          ) : null}
          {importResult?.rows?.length ? (
            <TableWrapper>
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Errores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.rows.map((row) => (
                      <TableRow key={`${row.row}-${row.reference ?? ''}`}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell>{row.reference ?? '-'}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.errors?.join(', ') ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </TableWrapper>
          ) : null}
        </CardContent>
      </Card>
    ) : null}
      {canImport ? (
        <Card>
          <CardHeader>
            <CardTitle className="page-title">Auditoria envios</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLoading ? <div className="helper">Cargando...</div> : null}
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.length ? auditRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.created_at}</TableCell>
                      <TableCell>{row.event}</TableCell>
                      <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                      <TableCell>{typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata ?? {})}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4}>Sin eventos</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
