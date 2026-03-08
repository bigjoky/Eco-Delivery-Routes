import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DepotSummary, HubSummary, PointSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

type CreateType = '' | 'hub' | 'depot' | 'point';

export function NetworkPage() {
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [depots, setDepots] = useState<DepotSummary[]>([]);
  const [points, setPoints] = useState<PointSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [hubFilter, setHubFilter] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
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

  const activeHubs = useMemo(() => hubs.filter((item) => item.is_active), [hubs]);
  const depotsForPointHub = useMemo(() => depots.filter((item) => item.hub_id === createPointHubId), [depots, createPointHubId]);
  const normalizedQuery = query.trim().toLowerCase();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [hubRows, depotRows, pointRows] = await Promise.all([
        apiClient.getHubs({ onlyActive: false, includeDeleted }),
        apiClient.getDepots({ includeDeleted }),
        apiClient.getPoints({ includeDeleted }),
      ]);
      setHubs(hubRows);
      setDepots(depotRows);
      setPoints(pointRows);
      if (!createDepotHubId && hubRows[0]?.id) setCreateDepotHubId(hubRows[0].id);
      if (!createPointHubId && hubRows[0]?.id) setCreatePointHubId(hubRows[0].id);
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
  };

  const openCreateWizard = (nextType: CreateType = '') => {
    resetCreateWizard(nextType);
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
        await apiClient.createHub({ name: createHubName.trim(), city: createHubCity.trim() });
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
        });
        setMessage('Punto creado.');
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

  const hubCode = new Map(hubs.map((item) => [item.id, item.code]));
  const depotCode = new Map(depots.map((item) => [item.id, item.code]));
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

  return (
    <div className="page-grid">
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
          <div className="helper">1) Selecciona tipo de nodo</div>
          <div className="inline-actions">
            <Button type="button" variant={createType === 'hub' ? 'secondary' : 'outline'} onClick={() => setCreateType('hub')}>Hub</Button>
            <Button type="button" variant={createType === 'depot' ? 'secondary' : 'outline'} onClick={() => setCreateType('depot')}>Depot</Button>
            <Button type="button" variant={createType === 'point' ? 'secondary' : 'outline'} onClick={() => setCreateType('point')}>Punto</Button>
          </div>
          {createType === 'hub' ? (
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
          ) : null}
          {createType === 'depot' ? (
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
          ) : null}
          {createType === 'point' ? (
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
          ) : null}
        </div>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">Red operativa</h1>
        <div className="page-subtitle">Gestiona hubs, depots y puntos con numeración propia automática.</div>
      </div>

      <div className="inline-actions">
        <Button type="button" className="btn btn-default" onClick={() => openCreateWizard()}>+ Crear</Button>
        <Button type="button" variant={showFilters ? 'secondary' : 'outline'} onClick={() => setShowFilters((value) => !value)}>
          {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
        </Button>
        <Button type="button" className="btn btn-outline" onClick={load} disabled={loading}>{loading ? 'Cargando...' : 'Recargar'}</Button>
      </div>
      {message ? <div className="helper">{message}</div> : null}
      {error ? <div className="helper error">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Crear nodos rápidamente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => openCreateWizard('hub')}>Nuevo Hub</Button>
            <Button type="button" variant="outline" onClick={() => openCreateWizard('depot')}>Nuevo Depot</Button>
            <Button type="button" variant="outline" onClick={() => openCreateWizard('point')}>Nuevo Punto</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de red</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item"><div className="kpi-label">Hubs</div><div className="kpi-value">{hubs.length}</div></div>
            <div className="kpi-item"><div className="kpi-label">Depots</div><div className="kpi-value">{depots.length}</div></div>
            <div className="kpi-item"><div className="kpi-label">Puntos</div><div className="kpi-value">{points.length}</div></div>
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
        <CardHeader><CardTitle>Hubs</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Depots</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Puntos</CardTitle></CardHeader>
        <CardContent>
          <TableWrapper>
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
        </CardContent>
      </Card>
    </div>
  );
}
