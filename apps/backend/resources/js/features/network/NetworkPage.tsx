import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AgencySummary, DepotSummary, HubSummary, PointSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

type CreateType = '' | 'hub' | 'depot' | 'point' | 'agency';

export function NetworkPage() {
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [depots, setDepots] = useState<DepotSummary[]>([]);
  const [points, setPoints] = useState<PointSummary[]>([]);
  const [agencies, setAgencies] = useState<AgencySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [hubFilter, setHubFilter] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [editingHubId, setEditingHubId] = useState('');
  const [editingHubName, setEditingHubName] = useState('');
  const [editingHubCity, setEditingHubCity] = useState('');
  const [editingDepotId, setEditingDepotId] = useState('');
  const [editingDepotName, setEditingDepotName] = useState('');
  const [editingDepotCity, setEditingDepotCity] = useState('');
  const [editingPointId, setEditingPointId] = useState('');
  const [editingPointName, setEditingPointName] = useState('');
  const [editingPointCity, setEditingPointCity] = useState('');
  const [editingAgencyId, setEditingAgencyId] = useState('');
  const [editingAgencyName, setEditingAgencyName] = useState('');
  const [editingAgencyCity, setEditingAgencyCity] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<CreateType>('');
  const [createSaving, setCreateSaving] = useState(false);
  const [createHubName, setCreateHubName] = useState('');
  const [createHubCity, setCreateHubCity] = useState('');
  const [createDepotHubId, setCreateDepotHubId] = useState('');
  const [createDepotName, setCreateDepotName] = useState('');
  const [createDepotCity, setCreateDepotCity] = useState('');
  const [createPointHubId, setCreatePointHubId] = useState('');
  const [createPointDepotId, setCreatePointDepotId] = useState('');
  const [createPointName, setCreatePointName] = useState('');
  const [createPointCity, setCreatePointCity] = useState('');
  const [createAgencyHubId, setCreateAgencyHubId] = useState('');
  const [createAgencyName, setCreateAgencyName] = useState('');
  const [createAgencyCity, setCreateAgencyCity] = useState('');
  const [createAgencyTaxId, setCreateAgencyTaxId] = useState('');
  const [createAddressLine, setCreateAddressLine] = useState('');
  const [createPostalCode, setCreatePostalCode] = useState('');
  const [createProvince, setCreateProvince] = useState('');
  const [createContactName, setCreateContactName] = useState('');
  const [createContactPhone, setCreateContactPhone] = useState('');
  const [createContactEmail, setCreateContactEmail] = useState('');
  const [createManagerName, setCreateManagerName] = useState('');
  const [createNotes, setCreateNotes] = useState('');

  const activeHubs = useMemo(() => hubs.filter((item) => item.is_active), [hubs]);
  const depotsForPointHub = useMemo(() => depots.filter((item) => item.hub_id === createPointHubId), [depots, createPointHubId]);
  const normalizedQuery = query.trim().toLowerCase();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [hubRows, depotRows, pointRows, agencyRows] = await Promise.all([
        apiClient.getHubs({ onlyActive: false, includeDeleted }),
        apiClient.getDepots({ includeDeleted }),
        apiClient.getPoints({ includeDeleted }),
        apiClient.getAgencies({ includeDeleted }),
      ]);
      setHubs(hubRows);
      setDepots(depotRows);
      setPoints(pointRows);
      setAgencies(agencyRows);
      if (!createDepotHubId && hubRows[0]?.id) setCreateDepotHubId(hubRows[0].id);
      if (!createPointHubId && hubRows[0]?.id) setCreatePointHubId(hubRows[0].id);
      if (!createAgencyHubId && hubRows[0]?.id) setCreateAgencyHubId(hubRows[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar red operativa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [includeDeleted]);

  useEffect(() => {
    if (!createPointHubId) {
      setCreatePointDepotId('');
      return;
    }
    const firstDepot = depots.find((item) => item.hub_id === createPointHubId);
    if (!firstDepot) {
      setCreatePointDepotId('');
      return;
    }
    if (!createPointDepotId || !depots.some((item) => item.id === createPointDepotId && item.hub_id === createPointHubId)) {
      setCreatePointDepotId(firstDepot.id);
    }
  }, [createPointHubId, depots, createPointDepotId]);

  const resetCreateWizard = (nextType: CreateType = '') => {
    setCreateType(nextType);
    setCreateSaving(false);
    setCreateHubName('');
    setCreateHubCity('');
    setCreateDepotName('');
    setCreateDepotCity('');
    setCreatePointName('');
    setCreatePointCity('');
    setCreateAgencyName('');
    setCreateAgencyCity('');
    setCreateAgencyTaxId('');
    setCreateAddressLine('');
    setCreatePostalCode('');
    setCreateProvince('');
    setCreateContactName('');
    setCreateContactPhone('');
    setCreateContactEmail('');
    setCreateManagerName('');
    setCreateNotes('');
  };

  const openCreateWizard = (nextType: CreateType = '') => {
    resetCreateWizard(nextType);
    setCreateOpen(true);
  };

  const openCreateDepotFromHub = (hubId: string) => {
    resetCreateWizard('depot');
    setCreateDepotHubId(hubId);
    setCreateOpen(true);
  };

  const openCreatePointFromDepot = (hubId: string, depotId: string) => {
    resetCreateWizard('point');
    setCreatePointHubId(hubId);
    setCreatePointDepotId(depotId);
    setCreateOpen(true);
  };

  const closeCreateWizard = () => {
    setCreateOpen(false);
    setCreateSaving(false);
  };

  const submitCreateNode = async () => {
    setError('');
    setMessage('');
    setCreateSaving(true);
    try {
      if (createType === 'hub') {
        if (!createHubName.trim() || !createHubCity.trim()) {
          setError('Hub requiere nombre y ciudad.');
          return;
        }
        await apiClient.createHub({
          name: createHubName.trim(),
          city: createHubCity.trim(),
          address_line: createAddressLine.trim() || null,
          postal_code: createPostalCode.trim() || null,
          province: createProvince.trim() || null,
          contact_name: createContactName.trim() || null,
          contact_phone: createContactPhone.trim() || null,
          contact_email: createContactEmail.trim() || null,
          manager_name: createManagerName.trim() || null,
          notes: createNotes.trim() || null,
        });
        setMessage('Hub creado.');
      } else if (createType === 'depot') {
        if (!createDepotHubId || !createDepotName.trim()) {
          setError('Depot requiere hub y nombre.');
          return;
        }
        await apiClient.createDepot({
          hub_id: createDepotHubId,
          name: createDepotName.trim(),
          city: createDepotCity.trim() || null,
          address_line: createAddressLine.trim() || null,
          postal_code: createPostalCode.trim() || null,
          province: createProvince.trim() || null,
          contact_name: createContactName.trim() || null,
          contact_phone: createContactPhone.trim() || null,
          contact_email: createContactEmail.trim() || null,
          manager_name: createManagerName.trim() || null,
          notes: createNotes.trim() || null,
        });
        setMessage('Depot creado.');
      } else if (createType === 'point') {
        if (!createPointHubId || !createPointName.trim()) {
          setError('Punto requiere hub y nombre.');
          return;
        }
        await apiClient.createPoint({
          hub_id: createPointHubId,
          depot_id: createPointDepotId || null,
          name: createPointName.trim(),
          city: createPointCity.trim() || null,
          address_line: createAddressLine.trim() || null,
          postal_code: createPostalCode.trim() || null,
          province: createProvince.trim() || null,
          contact_name: createContactName.trim() || null,
          contact_phone: createContactPhone.trim() || null,
          contact_email: createContactEmail.trim() || null,
          manager_name: createManagerName.trim() || null,
          notes: createNotes.trim() || null,
        });
        setMessage('Punto creado.');
      } else if (createType === 'agency') {
        if (!createAgencyName.trim()) {
          setError('Agencia requiere nombre.');
          return;
        }
        await apiClient.createAgency({
          hub_id: createAgencyHubId || null,
          name: createAgencyName.trim(),
          legal_name: createAgencyName.trim(),
          tax_id: createAgencyTaxId.trim() || null,
          city: createAgencyCity.trim() || null,
          address_line: createAddressLine.trim() || null,
          postal_code: createPostalCode.trim() || null,
          province: createProvince.trim() || null,
          contact_name: createContactName.trim() || null,
          contact_phone: createContactPhone.trim() || null,
          contact_email: createContactEmail.trim() || null,
          manager_name: createManagerName.trim() || null,
          notes: createNotes.trim() || null,
        });
        setMessage('Agencia creada.');
      } else {
        setError('Selecciona qué tipo de nodo deseas crear.');
        return;
      }

      closeCreateWizard();
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear nodo.');
    } finally {
      setCreateSaving(false);
    }
  };

  const startEditHub = (item: HubSummary) => {
    setEditingHubId(item.id);
    setEditingHubName(item.name);
    setEditingHubCity(item.city ?? '');
  };

  const startEditDepot = (item: DepotSummary) => {
    setEditingDepotId(item.id);
    setEditingDepotName(item.name);
    setEditingDepotCity(item.city ?? '');
  };

  const startEditPoint = (item: PointSummary) => {
    setEditingPointId(item.id);
    setEditingPointName(item.name);
    setEditingPointCity(item.city ?? '');
  };

  const startEditAgency = (item: AgencySummary) => {
    setEditingAgencyId(item.id);
    setEditingAgencyName(item.name);
    setEditingAgencyCity(item.city ?? '');
  };

  const saveHub = async () => {
    if (!editingHubId) return;
    setError('');
    setMessage('');
    try {
      await apiClient.updateHub(editingHubId, { name: editingHubName.trim(), city: editingHubCity.trim() });
      setEditingHubId('');
      setMessage('Hub actualizado.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar hub.');
    }
  };

  const saveDepot = async () => {
    if (!editingDepotId) return;
    setError('');
    setMessage('');
    try {
      await apiClient.updateDepot(editingDepotId, { name: editingDepotName.trim(), city: editingDepotCity.trim() || null });
      setEditingDepotId('');
      setMessage('Depot actualizado.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar depot.');
    }
  };

  const savePoint = async () => {
    if (!editingPointId) return;
    setError('');
    setMessage('');
    try {
      await apiClient.updatePoint(editingPointId, { name: editingPointName.trim(), city: editingPointCity.trim() || null });
      setEditingPointId('');
      setMessage('Punto actualizado.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar punto.');
    }
  };

  const saveAgency = async () => {
    if (!editingAgencyId) return;
    setError('');
    setMessage('');
    try {
      await apiClient.updateAgency(editingAgencyId, { name: editingAgencyName.trim(), city: editingAgencyCity.trim() || null });
      setEditingAgencyId('');
      setMessage('Agencia actualizada.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar agencia.');
    }
  };

  const removeHub = async (item: HubSummary) => {
    if (!window.confirm(`Eliminar hub ${item.code}?`)) return;
    setError('');
    setMessage('');
    try {
      await apiClient.deleteHub(item.id);
      setMessage('Hub eliminado.');
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar hub.');
    }
  };

  const restoreHub = async (item: HubSummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.restoreHub(item.id);
      setMessage('Hub restaurado.');
      await load();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar hub.');
    }
  };

  const removeDepot = async (item: DepotSummary) => {
    if (!window.confirm(`Eliminar depot ${item.code}?`)) return;
    setError('');
    setMessage('');
    try {
      await apiClient.deleteDepot(item.id);
      setMessage('Depot eliminado.');
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar depot.');
    }
  };

  const restoreDepot = async (item: DepotSummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.restoreDepot(item.id);
      setMessage('Depot restaurado.');
      await load();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar depot.');
    }
  };

  const removePoint = async (item: PointSummary) => {
    if (!window.confirm(`Eliminar punto ${item.code}?`)) return;
    setError('');
    setMessage('');
    try {
      await apiClient.deletePoint(item.id);
      setMessage('Punto eliminado.');
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar punto.');
    }
  };

  const restorePoint = async (item: PointSummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.restorePoint(item.id);
      setMessage('Punto restaurado.');
      await load();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar punto.');
    }
  };

  const removeAgency = async (item: AgencySummary) => {
    if (!window.confirm(`Archivar agencia ${item.code}?`)) return;
    setError('');
    setMessage('');
    try {
      await apiClient.deleteAgency(item.id);
      setMessage('Agencia archivada.');
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo archivar agencia.');
    }
  };

  const restoreAgency = async (item: AgencySummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.restoreAgency(item.id);
      setMessage('Agencia restaurada.');
      await load();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar agencia.');
    }
  };

  const toggleHubActive = async (item: HubSummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.updateHub(item.id, { is_active: !item.is_active });
      setMessage(`Hub ${item.is_active ? 'desactivado' : 'activado'}.`);
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo cambiar el estado del hub.');
    }
  };

  const toggleDepotActive = async (item: DepotSummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.updateDepot(item.id, { is_active: !item.is_active });
      setMessage(`Depot ${item.is_active ? 'desactivado' : 'activado'}.`);
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo cambiar el estado del depot.');
    }
  };

  const togglePointActive = async (item: PointSummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.updatePoint(item.id, { is_active: !item.is_active });
      setMessage(`Punto ${item.is_active ? 'desactivado' : 'activado'}.`);
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo cambiar el estado del punto.');
    }
  };

  const toggleAgencyActive = async (item: AgencySummary) => {
    setError('');
    setMessage('');
    try {
      await apiClient.updateAgency(item.id, { is_active: !item.is_active });
      setMessage(`Agencia ${item.is_active ? 'desactivada' : 'activada'}.`);
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo cambiar el estado de la agencia.');
    }
  };

  const hubCode = new Map(hubs.map((item) => [item.id, item.code]));
  const depotCode = new Map(depots.map((item) => [item.id, item.code]));
  const filteredAgencies = useMemo(() => agencies.filter((item) => {
    if (!includeDeleted && item.deleted_at) return false;
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    if (hubFilter && item.hub_id !== hubFilter) return false;
    if (normalizedQuery) {
      const haystack = `${item.code} ${item.name} ${item.city ?? ''} ${item.tax_id ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [agencies, includeDeleted, statusFilter, hubFilter, normalizedQuery]);
  const filteredHubs = useMemo(() => hubs.filter((item) => {
    if (!includeDeleted && item.deleted_at) return false;
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    if (normalizedQuery) {
      const haystack = `${item.code} ${item.name} ${item.city ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [hubs, statusFilter, normalizedQuery, includeDeleted]);
  const filteredDepots = useMemo(() => depots.filter((item) => {
    if (!includeDeleted && item.deleted_at) return false;
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    if (hubFilter && item.hub_id !== hubFilter) return false;
    if (normalizedQuery) {
      const haystack = `${item.code} ${item.name} ${item.city ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [depots, statusFilter, hubFilter, normalizedQuery, includeDeleted]);
  const filteredPoints = useMemo(() => points.filter((item) => {
    if (!includeDeleted && item.deleted_at) return false;
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    if (hubFilter && item.hub_id !== hubFilter) return false;
    if (normalizedQuery) {
      const haystack = `${item.code} ${item.name} ${item.city ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [points, statusFilter, hubFilter, normalizedQuery, includeDeleted]);

  const hasActiveFilters = normalizedQuery.length > 0 || statusFilter !== 'all' || hubFilter !== '' || includeDeleted !== true;

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setHubFilter('');
    setIncludeDeleted(true);
  };

  return (
    <div className="page-grid">
      <div className="inline-actions">
        <Link to="/dashboard" className="helper">Dashboard</Link>
        <span className="helper">/</span>
        <span className="helper">Red Operativa</span>
      </div>
      <Modal
        open={createOpen}
        onClose={closeCreateWizard}
        title="Crear nodo de red"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closeCreateWizard}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitCreateNode} disabled={createSaving}>
              {createSaving ? 'Creando...' : 'Crear'}
            </Button>
          </>
        )}
      >
        <div className="page-grid">
          <div className="modal-section">
          <div className="modal-section-title">Paso 1 · Tipo de nodo</div>
          <div className="modal-section-copy">Crea hubs, depots y puntos desde un único flujo operativo.</div>
          <div className="inline-actions">
            <Button type="button" variant={createType === 'hub' ? 'secondary' : 'outline'} onClick={() => setCreateType('hub')}>Hub</Button>
            <Button type="button" variant={createType === 'depot' ? 'secondary' : 'outline'} onClick={() => setCreateType('depot')}>Depot</Button>
            <Button type="button" variant={createType === 'point' ? 'secondary' : 'outline'} onClick={() => setCreateType('point')}>Punto</Button>
            <Button type="button" variant={createType === 'agency' ? 'secondary' : 'outline'} onClick={() => setCreateType('agency')}>Agencia</Button>
          </div>
          </div>
          {createType === 'hub' ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 2 · Datos del hub</div>
            <div className="form-row">
              <div>
                <label htmlFor="create-node-hub-name">Nombre</label>
                <Input id="create-node-hub-name" value={createHubName} onChange={(event) => setCreateHubName(event.target.value)} placeholder="Hub Malaga Este" />
              </div>
              <div>
                <label htmlFor="create-node-hub-city">Ciudad</label>
                <Input id="create-node-hub-city" value={createHubCity} onChange={(event) => setCreateHubCity(event.target.value)} placeholder="Malaga" />
              </div>
            </div>
            </div>
          ) : null}
          {createType === 'depot' ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 2 · Datos del depot</div>
            <div className="form-row">
              <div>
                <label htmlFor="create-node-depot-hub">Hub</label>
                <Select id="create-node-depot-hub" value={createDepotHubId} onChange={(event) => setCreateDepotHubId(event.target.value)}>
                  <option value="">Selecciona hub</option>
                  {activeHubs.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="create-node-depot-name">Nombre</label>
                <Input id="create-node-depot-name" value={createDepotName} onChange={(event) => setCreateDepotName(event.target.value)} placeholder="Depot Centro" />
              </div>
              <div>
                <label htmlFor="create-node-depot-city">Ciudad</label>
                <Input id="create-node-depot-city" value={createDepotCity} onChange={(event) => setCreateDepotCity(event.target.value)} placeholder="Malaga" />
              </div>
            </div>
            </div>
          ) : null}
          {createType === 'point' ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 2 · Datos del punto</div>
            <div className="form-row">
              <div>
                <label htmlFor="create-node-point-hub">Hub</label>
                <Select id="create-node-point-hub" value={createPointHubId} onChange={(event) => setCreatePointHubId(event.target.value)}>
                  <option value="">Selecciona hub</option>
                  {activeHubs.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="create-node-point-depot">Depot</label>
                <Select id="create-node-point-depot" value={createPointDepotId} onChange={(event) => setCreatePointDepotId(event.target.value)}>
                  <option value="">Sin depot</option>
                  {depotsForPointHub.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="create-node-point-name">Nombre</label>
                <Input id="create-node-point-name" value={createPointName} onChange={(event) => setCreatePointName(event.target.value)} placeholder="Punto Zona Norte" />
              </div>
              <div>
                <label htmlFor="create-node-point-city">Ciudad</label>
                <Input id="create-node-point-city" value={createPointCity} onChange={(event) => setCreatePointCity(event.target.value)} placeholder="Malaga" />
              </div>
            </div>
            </div>
          ) : null}
          {createType === 'agency' ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 2 · Datos de la agencia</div>
              <div className="form-row">
                <div>
                  <label htmlFor="create-node-agency-hub">Hub</label>
                  <Select id="create-node-agency-hub" value={createAgencyHubId} onChange={(event) => setCreateAgencyHubId(event.target.value)}>
                    <option value="">Sin hub principal</option>
                    {activeHubs.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label htmlFor="create-node-agency-name">Nombre</label>
                  <Input id="create-node-agency-name" value={createAgencyName} onChange={(event) => setCreateAgencyName(event.target.value)} placeholder="Agencia Costa Oeste" />
                </div>
                <div>
                  <label htmlFor="create-node-agency-tax">CIF</label>
                  <Input id="create-node-agency-tax" value={createAgencyTaxId} onChange={(event) => setCreateAgencyTaxId(event.target.value)} placeholder="B12345678" />
                </div>
                <div>
                  <label htmlFor="create-node-agency-city">Ciudad</label>
                  <Input id="create-node-agency-city" value={createAgencyCity} onChange={(event) => setCreateAgencyCity(event.target.value)} placeholder="Malaga" />
                </div>
              </div>
            </div>
          ) : null}
          {createType ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 3 · Dirección y contacto</div>
              <div className="form-row">
                <div>
                  <label htmlFor="create-node-address-line">Dirección</label>
                  <Input id="create-node-address-line" value={createAddressLine} onChange={(event) => setCreateAddressLine(event.target.value)} placeholder="Calle, número, nave..." />
                </div>
                <div>
                  <label htmlFor="create-node-postal">CP</label>
                  <Input id="create-node-postal" value={createPostalCode} onChange={(event) => setCreatePostalCode(event.target.value)} placeholder="29004" />
                </div>
                <div>
                  <label htmlFor="create-node-province">Provincia</label>
                  <Input id="create-node-province" value={createProvince} onChange={(event) => setCreateProvince(event.target.value)} placeholder="Málaga" />
                </div>
                <div>
                  <label htmlFor="create-node-contact-name">Contacto</label>
                  <Input id="create-node-contact-name" value={createContactName} onChange={(event) => setCreateContactName(event.target.value)} placeholder="Responsable operativo" />
                </div>
                <div>
                  <label htmlFor="create-node-contact-phone">Teléfono</label>
                  <Input id="create-node-contact-phone" value={createContactPhone} onChange={(event) => setCreateContactPhone(event.target.value)} placeholder="+34 600 000 000" />
                </div>
                <div>
                  <label htmlFor="create-node-contact-email">Email</label>
                  <Input id="create-node-contact-email" value={createContactEmail} onChange={(event) => setCreateContactEmail(event.target.value)} placeholder="operativa@eco.test" />
                </div>
                <div>
                  <label htmlFor="create-node-manager">Manager</label>
                  <Input id="create-node-manager" value={createManagerName} onChange={(event) => setCreateManagerName(event.target.value)} placeholder="Nombre responsable" />
                </div>
                <div>
                  <label htmlFor="create-node-notes">Notas</label>
                  <Input id="create-node-notes" value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} placeholder="Horario, acceso, observaciones" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">Red operativa</h1>
        <div className="page-subtitle">Gestiona hubs, depots, puntos y agencias con numeración propia automática y baja lógica.</div>
      </div>

      <div className="inline-actions">
        <Button type="button" className="btn btn-default" onClick={() => openCreateWizard()}>+ Crear</Button>
        <Button type="button" variant={showFilters ? 'secondary' : 'outline'} onClick={() => setShowFilters((value) => !value)}>
          {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
        </Button>
        <Button type="button" className="btn btn-outline" onClick={load} disabled={loading}>{loading ? 'Cargando...' : 'Recargar'}</Button>
        <span className="helper">
          Hubs {filteredHubs.length}/{hubs.length} | Depots {filteredDepots.length}/{depots.length} | Puntos {filteredPoints.length}/{points.length} | Agencias {filteredAgencies.length}/{agencies.length}
        </span>
        {hasActiveFilters ? (
          <Button type="button" variant="outline" onClick={resetFilters}>Reset filtros</Button>
        ) : null}
      </div>
      {message ? <div className="helper">{message}</div> : null}
      {error ? <div className="helper error">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Resumen de red</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item"><div className="kpi-label">Hubs</div><div className="kpi-value">{hubs.length}</div></div>
            <div className="kpi-item"><div className="kpi-label">Depots</div><div className="kpi-value">{depots.length}</div></div>
            <div className="kpi-item"><div className="kpi-label">Puntos</div><div className="kpi-value">{points.length}</div></div>
            <div className="kpi-item"><div className="kpi-label">Agencias</div><div className="kpi-value">{agencies.length}</div></div>
          </div>
        </CardContent>
      </Card>

      {showFilters ? (
        <Card>
          <CardHeader>
            <CardTitle>Filtros de red operativa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="form-row">
              <div>
                <label htmlFor="network-query">Buscar</label>
                <Input id="network-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="codigo, nombre o ciudad" />
              </div>
              <div>
                <label htmlFor="network-status">Estado</label>
                <Select id="network-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </Select>
              </div>
              <div>
                <label htmlFor="network-hub-filter">Hub</label>
                <Select id="network-hub-filter" value={hubFilter} onChange={(event) => setHubFilter(event.target.value)}>
                  <option value="">Todos</option>
                  {hubs.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="network-include-deleted">Archivados</label>
                <Select id="network-include-deleted" value={includeDeleted ? '1' : '0'} onChange={(event) => setIncludeDeleted(event.target.value === '1')}>
                  <option value="0">Ocultar archivados</option>
                  <option value="1">Mostrar archivados</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Agencias</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Hub</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>CIF</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgencies.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.hub_id ? (hubCode.get(item.hub_id) ?? item.hub_id) : '-'}</TableCell>
                    <TableCell>{editingAgencyId === item.id ? <Input value={editingAgencyName} onChange={(event) => setEditingAgencyName(event.target.value)} /> : `${item.name}${item.deleted_at ? ' (Archivada)' : ''}`}</TableCell>
                    <TableCell>{editingAgencyId === item.id ? <Input value={editingAgencyCity} onChange={(event) => setEditingAgencyCity(event.target.value)} /> : (item.city ?? '-')}</TableCell>
                    <TableCell>{item.tax_id ?? '-'}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        {item.deleted_at
                          ? <Button type="button" variant="outline" onClick={() => restoreAgency(item)}>Restaurar</Button>
                          : (
                            <>
                              {editingAgencyId === item.id
                                ? <Button type="button" variant="outline" onClick={saveAgency}>Guardar</Button>
                                : <Button type="button" variant="outline" onClick={() => startEditAgency(item)}>Editar</Button>}
                              <Button type="button" variant="outline" onClick={() => toggleAgencyActive(item)}>
                                {item.is_active ? 'Dar de baja' : 'Activar'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => removeAgency(item)}>Archivar</Button>
                            </>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {filteredAgencies.map((item) => (
              <article key={`agency-mobile-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{item.code}</strong>
                    <div className="helper">{item.name}</div>
                  </div>
                  <Badge variant="secondary">{item.deleted_at ? 'archivada' : (item.is_active ? 'activa' : 'inactiva')}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Hub</div>
                    <div>{item.hub_id ? (hubCode.get(item.hub_id) ?? item.hub_id) : '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">CIF</div>
                    <div>{item.tax_id ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Ciudad</div>
                    <div>{item.city ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Contacto</div>
                    <div>{item.contact_name ?? item.contact_phone ?? '-'}</div>
                  </div>
                </div>
                {(item.address_line || item.notes) ? (
                  <div className="helper">{item.address_line ?? item.notes}</div>
                ) : null}
                <div className="mobile-ops-card-actions">
                  {item.deleted_at ? (
                    <Button type="button" variant="outline" onClick={() => restoreAgency(item)}>Restaurar</Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => startEditAgency(item)}>Editar</Button>
                      <Button type="button" variant="outline" onClick={() => toggleAgencyActive(item)}>
                        {item.is_active ? 'Dar de baja' : 'Activar'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => removeAgency(item)}>Archivar</Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hubs</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHubs.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{editingHubId === item.id ? <Input value={editingHubName} onChange={(event) => setEditingHubName(event.target.value)} /> : `${item.name}${item.deleted_at ? ' (Archivado)' : ''}`}</TableCell>
                    <TableCell>{editingHubId === item.id ? <Input value={editingHubCity} onChange={(event) => setEditingHubCity(event.target.value)} /> : (item.city ?? '-')}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        {item.deleted_at
                          ? <Button type="button" variant="outline" onClick={() => restoreHub(item)}>Restaurar</Button>
                          : (
                            <>
                              {editingHubId === item.id
                                ? <Button type="button" variant="outline" onClick={saveHub}>Guardar</Button>
                                : <Button type="button" variant="outline" onClick={() => startEditHub(item)}>Editar</Button>}
                              <Button type="button" variant="outline" onClick={() => toggleHubActive(item)}>
                                {item.is_active ? 'Dar de baja' : 'Activar'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => removeHub(item)}>Archivar</Button>
                            </>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {filteredHubs.map((item) => (
              <article key={`hub-mobile-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{item.code}</strong>
                    <div className="helper">{item.name}</div>
                  </div>
                  <Badge variant="secondary">{item.deleted_at ? 'archivado' : (item.is_active ? 'activo' : 'inactivo')}</Badge>
                </div>
                <div className="helper">{item.city ?? '-'}</div>
                {(item.contact_name || item.contact_phone || item.address_line) ? (
                  <div className="helper">{item.contact_name ?? item.contact_phone ?? item.address_line}</div>
                ) : null}
                <div className="mobile-ops-card-actions">
                  {item.deleted_at ? (
                    <Button type="button" variant="outline" onClick={() => restoreHub(item)}>Restaurar</Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => openCreateDepotFromHub(item.id)}>Nuevo depot</Button>
                      <Button type="button" variant="outline" onClick={() => startEditHub(item)}>Editar</Button>
                      <Button type="button" variant="outline" onClick={() => toggleHubActive(item)}>
                        {item.is_active ? 'Dar de baja' : 'Activar'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => removeHub(item)}>Archivar</Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Depots</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Hub</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepots.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{hubCode.get(item.hub_id) ?? item.hub_id}</TableCell>
                    <TableCell>{editingDepotId === item.id ? <Input value={editingDepotName} onChange={(event) => setEditingDepotName(event.target.value)} /> : `${item.name}${item.deleted_at ? ' (Archivado)' : ''}`}</TableCell>
                    <TableCell>{editingDepotId === item.id ? <Input value={editingDepotCity} onChange={(event) => setEditingDepotCity(event.target.value)} /> : (item.city ?? '-')}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        {item.deleted_at
                          ? <Button type="button" variant="outline" onClick={() => restoreDepot(item)}>Restaurar</Button>
                          : (
                            <>
                              {editingDepotId === item.id
                                ? <Button type="button" variant="outline" onClick={saveDepot}>Guardar</Button>
                                : <Button type="button" variant="outline" onClick={() => startEditDepot(item)}>Editar</Button>}
                              <Button type="button" variant="outline" onClick={() => toggleDepotActive(item)}>
                                {item.is_active ? 'Dar de baja' : 'Activar'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => removeDepot(item)}>Archivar</Button>
                            </>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {filteredDepots.map((item) => (
              <article key={`depot-mobile-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{item.code}</strong>
                    <div className="helper">{item.name}</div>
                  </div>
                  <Badge variant="secondary">{item.deleted_at ? 'archivado' : (item.is_active ? 'activo' : 'inactivo')}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Hub</div>
                    <div>{hubCode.get(item.hub_id) ?? item.hub_id}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Ciudad</div>
                    <div>{item.city ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Contacto</div>
                    <div>{item.contact_name ?? item.contact_phone ?? '-'}</div>
                  </div>
                </div>
                <div className="mobile-ops-card-actions">
                  {item.deleted_at ? (
                    <Button type="button" variant="outline" onClick={() => restoreDepot(item)}>Restaurar</Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => openCreatePointFromDepot(item.hub_id, item.id)}>Nuevo punto</Button>
                      <Button type="button" variant="outline" onClick={() => startEditDepot(item)}>Editar</Button>
                      <Button type="button" variant="outline" onClick={() => toggleDepotActive(item)}>
                        {item.is_active ? 'Dar de baja' : 'Activar'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => removeDepot(item)}>Archivar</Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Puntos</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Hub</TableHead>
                  <TableHead>Depot</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPoints.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{hubCode.get(item.hub_id) ?? item.hub_id}</TableCell>
                    <TableCell>{item.depot_id ? (depotCode.get(item.depot_id) ?? item.depot_id) : '-'}</TableCell>
                    <TableCell>{editingPointId === item.id ? <Input value={editingPointName} onChange={(event) => setEditingPointName(event.target.value)} /> : `${item.name}${item.deleted_at ? ' (Archivado)' : ''}`}</TableCell>
                    <TableCell>{editingPointId === item.id ? <Input value={editingPointCity} onChange={(event) => setEditingPointCity(event.target.value)} /> : (item.city ?? '-')}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        {item.deleted_at
                          ? <Button type="button" variant="outline" onClick={() => restorePoint(item)}>Restaurar</Button>
                          : (
                            <>
                              {editingPointId === item.id
                                ? <Button type="button" variant="outline" onClick={savePoint}>Guardar</Button>
                                : <Button type="button" variant="outline" onClick={() => startEditPoint(item)}>Editar</Button>}
                              <Button type="button" variant="outline" onClick={() => togglePointActive(item)}>
                                {item.is_active ? 'Dar de baja' : 'Activar'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => removePoint(item)}>Archivar</Button>
                            </>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {filteredPoints.map((item) => (
              <article key={`point-mobile-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{item.code}</strong>
                    <div className="helper">{item.name}</div>
                  </div>
                  <Badge variant="secondary">{item.deleted_at ? 'archivado' : (item.is_active ? 'activo' : 'inactivo')}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Hub</div>
                    <div>{hubCode.get(item.hub_id) ?? item.hub_id}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Depot</div>
                    <div>{item.depot_id ? (depotCode.get(item.depot_id) ?? item.depot_id) : '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Ciudad</div>
                    <div>{item.city ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Contacto</div>
                    <div>{item.contact_name ?? item.contact_phone ?? '-'}</div>
                  </div>
                </div>
                <div className="mobile-ops-card-actions">
                  {item.deleted_at ? (
                    <Button type="button" variant="outline" onClick={() => restorePoint(item)}>Restaurar</Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => startEditPoint(item)}>Editar</Button>
                      <Button type="button" variant="outline" onClick={() => togglePointActive(item)}>
                        {item.is_active ? 'Dar de baja' : 'Activar'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => removePoint(item)}>Archivar</Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
