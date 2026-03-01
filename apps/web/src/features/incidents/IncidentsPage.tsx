import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { IncidentCatalogItem, IncidentSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { useSearchParams } from 'react-router-dom';

function categoryVariant(category: IncidentSummary['category']): 'warning' | 'destructive' | 'secondary' | 'outline' {
  if (category === 'failed') return 'destructive';
  if (category === 'absent') return 'warning';
  if (category === 'retry') return 'secondary';
  return 'outline';
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
  const [listIncidentableId, setListIncidentableId] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedFromParams = useRef(false);

  const reload = () => apiClient.getIncidents({
    resolved: resolvedFilter || undefined,
    incidentableType: listTypeFilter || undefined,
    category: listCategoryFilter || undefined,
    catalogCode: listCatalogFilter || undefined,
    incidentableId: listIncidentableId || undefined,
    q: listSearch || undefined,
    page,
    perPage: 20,
  }).then((result) => {
    setItems(result.data);
    setLastPage(result.meta.last_page || 1);
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
  }, [resolvedFilter, page, listTypeFilter, listCategoryFilter, listCatalogFilter, listIncidentableId, listSearch]);

  useEffect(() => {
    if (initializedFromParams.current) return;
    const resolvedParam = searchParams.get('resolved') ?? 'open';
    const typeParam = searchParams.get('type') ?? '';
    const categoryParam = searchParams.get('category') ?? '';
    const catalogParam = searchParams.get('catalog') ?? '';
    const incidentableParam = searchParams.get('incidentable_id') ?? '';
    const searchParam = searchParams.get('q') ?? '';
    const pageParam = Number(searchParams.get('page') ?? '1');

    if (resolvedParam === 'open' || resolvedParam === 'resolved' || resolvedParam === '') {
      setResolvedFilter(resolvedParam as 'open' | 'resolved' | '');
    }
    if (typeParam === 'shipment' || typeParam === 'pickup') setListTypeFilter(typeParam);
    if (categoryParam) setListCategoryFilter(categoryParam as 'failed' | 'absent' | 'retry' | 'general' | '');
    if (catalogParam) setListCatalogFilter(catalogParam);
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
    if (listIncidentableId) params.set('incidentable_id', listIncidentableId);
    if (listSearch) params.set('q', listSearch);
    params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [resolvedFilter, listTypeFilter, listCategoryFilter, listCatalogFilter, listIncidentableId, page, setSearchParams]);

  const availableCatalog = useMemo(
    () => catalog.filter((item) => item.applies_to === incidentableType || item.applies_to === 'both'),
    [catalog, incidentableType]
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
  };

  const onResolve = async (id: string) => {
    await apiClient.resolveIncident(id, 'Resuelta desde panel web');
    await reload();
  };

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Registrar Incidencia</CardTitle>
          <CardDescription>Catalogo versionado de motivos para shipment y pickup.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onSubmit}>
            <div className="form-row">
              <Select value={incidentableType} onChange={(e) => setIncidentableType(e.target.value as 'shipment' | 'pickup')}>
                <option value="shipment">shipment</option>
                <option value="pickup">pickup</option>
              </Select>
              <Input value={incidentableId} onChange={(e) => setIncidentableId(e.target.value)} placeholder="Incidentable ID" />
            </div>
            <div className="form-row">
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
              <Input value={category} readOnly />
            </div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" />
            <Button type="submit">Registrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidencias recientes</CardTitle>
          <CardDescription>
            <div className="form-row">
              <Select value={resolvedFilter} onChange={(e) => { setResolvedFilter(e.target.value as 'open' | 'resolved' | ''); setPage(1); }}>
                <option value="">todas</option>
                <option value="open">abiertas</option>
                <option value="resolved">resueltas</option>
              </Select>
              <Select value={listTypeFilter} onChange={(e) => { setListTypeFilter(e.target.value as 'shipment' | 'pickup' | ''); setPage(1); }}>
                <option value="">tipo</option>
                <option value="shipment">shipment</option>
                <option value="pickup">pickup</option>
              </Select>
              <Select value={listCategoryFilter} onChange={(e) => { setListCategoryFilter(e.target.value as 'failed' | 'absent' | 'retry' | 'general' | ''); setPage(1); }}>
                <option value="">categoria</option>
                <option value="failed">failed</option>
                <option value="absent">absent</option>
                <option value="retry">retry</option>
                <option value="general">general</option>
              </Select>
              <Select value={listCatalogFilter} onChange={(e) => { setListCatalogFilter(e.target.value); setPage(1); }}>
                <option value="">catalogo</option>
                {catalog.map((item) => (
                  <option key={item.code} value={item.code}>{item.code}</option>
                ))}
              </Select>
              <Input value={listIncidentableId} onChange={(e) => { setListIncidentableId(e.target.value); setPage(1); }} placeholder="Incidentable ID" />
              <Input value={listSearch} onChange={(e) => { setListSearch(e.target.value); setPage(1); }} placeholder="Buscar (id, notas, catalogo)" />
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Catalogo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.incidentable_type}</TableCell>
                    <TableCell>{item.incidentable_id}</TableCell>
                    <TableCell>{item.catalog_code}</TableCell>
                    <TableCell><Badge variant={categoryVariant(item.category)}>{item.category}</Badge></TableCell>
                    <TableCell>{item.resolved_at ? 'resuelta' : 'abierta'}</TableCell>
                    <TableCell>
                      {item.resolved_at ? (
                        <span>-</span>
                      ) : (
                        <Button type="button" onClick={() => onResolve(item.id)}>Resolver</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="form-row">
            <Button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span>Pagina {page} de {lastPage}</span>
            <Button type="button" onClick={() => setPage((value) => Math.min(lastPage, value + 1))} disabled={page >= lastPage}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
