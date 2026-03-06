import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { DepotSummary, HubSummary, PointSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

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

  const [hubName, setHubName] = useState('');
  const [hubCity, setHubCity] = useState('');

  const [depotHubId, setDepotHubId] = useState('');
  const [depotName, setDepotName] = useState('');
  const [depotCity, setDepotCity] = useState('');

  const [pointHubId, setPointHubId] = useState('');
  const [pointDepotId, setPointDepotId] = useState('');
  const [pointName, setPointName] = useState('');
  const [pointCity, setPointCity] = useState('');

  const [editingHubId, setEditingHubId] = useState('');
  const [editingHubName, setEditingHubName] = useState('');
  const [editingHubCity, setEditingHubCity] = useState('');

  const [editingDepotId, setEditingDepotId] = useState('');
  const [editingDepotName, setEditingDepotName] = useState('');
  const [editingDepotCity, setEditingDepotCity] = useState('');

  const [editingPointId, setEditingPointId] = useState('');
  const [editingPointName, setEditingPointName] = useState('');
  const [editingPointCity, setEditingPointCity] = useState('');

  const activeHubs = useMemo(() => hubs.filter((item) => item.is_active), [hubs]);
  const depotsForPointHub = useMemo(() => depots.filter((item) => item.hub_id === pointHubId), [depots, pointHubId]);
  const normalizedQuery = query.trim().toLowerCase();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [hubRows, depotRows, pointRows] = await Promise.all([
        apiClient.getHubs({ onlyActive: false }),
        apiClient.getDepots(),
        apiClient.getPoints(),
      ]);
      setHubs(hubRows);
      setDepots(depotRows);
      setPoints(pointRows);
      if (!depotHubId && hubRows[0]?.id) setDepotHubId(hubRows[0].id);
      if (!pointHubId && hubRows[0]?.id) setPointHubId(hubRows[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar red operativa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!pointHubId) {
      setPointDepotId('');
      return;
    }
    const firstDepot = depots.find((item) => item.hub_id === pointHubId);
    if (!firstDepot) {
      setPointDepotId('');
      return;
    }
    if (!pointDepotId || !depots.some((item) => item.id === pointDepotId && item.hub_id === pointHubId)) {
      setPointDepotId(firstDepot.id);
    }
  }, [pointHubId, depots, pointDepotId]);

  const createHub = async (event: FormEvent) => {
    event.preventDefault();
    if (!hubName.trim() || !hubCity.trim()) {
      setError('Hub requiere nombre y ciudad.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await apiClient.createHub({ name: hubName.trim(), city: hubCity.trim() });
      setHubName('');
      setHubCity('');
      setMessage('Hub creado.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear hub.');
    }
  };

  const createDepot = async (event: FormEvent) => {
    event.preventDefault();
    if (!depotHubId || !depotName.trim()) {
      setError('Depot requiere hub y nombre.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await apiClient.createDepot({
        hub_id: depotHubId,
        name: depotName.trim(),
        city: depotCity.trim() || null,
      });
      setDepotName('');
      setDepotCity('');
      setMessage('Depot creado.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear depot.');
    }
  };

  const createPoint = async (event: FormEvent) => {
    event.preventDefault();
    if (!pointHubId || !pointName.trim()) {
      setError('Punto requiere hub y nombre.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await apiClient.createPoint({
        hub_id: pointHubId,
        depot_id: pointDepotId || null,
        name: pointName.trim(),
        city: pointCity.trim() || null,
      });
      setPointName('');
      setPointCity('');
      setMessage('Punto creado.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear punto.');
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

  const hubCode = new Map(hubs.map((item) => [item.id, item.code]));
  const depotCode = new Map(depots.map((item) => [item.id, item.code]));
  const filteredHubs = useMemo(() => hubs.filter((item) => {
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    if (normalizedQuery) {
      const haystack = `${item.code} ${item.name} ${item.city ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [hubs, statusFilter, normalizedQuery]);
  const filteredDepots = useMemo(() => depots.filter((item) => {
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    if (hubFilter && item.hub_id !== hubFilter) return false;
    if (normalizedQuery) {
      const haystack = `${item.code} ${item.name} ${item.city ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [depots, statusFilter, hubFilter, normalizedQuery]);
  const filteredPoints = useMemo(() => points.filter((item) => {
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    if (hubFilter && item.hub_id !== hubFilter) return false;
    if (normalizedQuery) {
      const haystack = `${item.code} ${item.name} ${item.city ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [points, statusFilter, hubFilter, normalizedQuery]);

  return (
    <div className="page-grid">
      <div className="page-header">
        <h1 className="page-title">Red operativa</h1>
        <div className="page-subtitle">Gestiona hubs, depots y puntos con numeración propia automática.</div>
      </div>

      <div className="inline-actions">
        <Button type="button" className="btn btn-outline" onClick={load} disabled={loading}>{loading ? 'Cargando...' : 'Recargar'}</Button>
      </div>
      {message ? <div className="helper">{message}</div> : null}
      {error ? <div className="helper">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Filtros de red operativa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="form-row">
            <div>
              <label htmlFor="network-query">Buscar</label>
              <Input
                id="network-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="codigo, nombre o ciudad"
              />
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear hub</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="form-row" onSubmit={createHub}>
            <div>
              <label htmlFor="hub-name">Nombre</label>
              <Input id="hub-name" value={hubName} onChange={(event) => setHubName(event.target.value)} placeholder="Hub Malaga Este" />
            </div>
            <div>
              <label htmlFor="hub-city">Ciudad</label>
              <Input id="hub-city" value={hubCity} onChange={(event) => setHubCity(event.target.value)} placeholder="Malaga" />
            </div>
            <div>
              <Button type="submit">Crear hub</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear depot</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="form-row" onSubmit={createDepot}>
            <div>
              <label htmlFor="depot-hub">Hub</label>
              <Select id="depot-hub" value={depotHubId} onChange={(event) => setDepotHubId(event.target.value)}>
                <option value="">Selecciona hub</option>
                {activeHubs.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="depot-name">Nombre</label>
              <Input id="depot-name" value={depotName} onChange={(event) => setDepotName(event.target.value)} placeholder="Depot Centro" />
            </div>
            <div>
              <label htmlFor="depot-city">Ciudad</label>
              <Input id="depot-city" value={depotCity} onChange={(event) => setDepotCity(event.target.value)} placeholder="Malaga" />
            </div>
            <div>
              <Button type="submit">Crear depot</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear punto</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="form-row" onSubmit={createPoint}>
            <div>
              <label htmlFor="point-hub">Hub</label>
              <Select id="point-hub" value={pointHubId} onChange={(event) => setPointHubId(event.target.value)}>
                <option value="">Selecciona hub</option>
                {activeHubs.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="point-depot">Depot</label>
              <Select id="point-depot" value={pointDepotId} onChange={(event) => setPointDepotId(event.target.value)}>
                <option value="">Sin depot</option>
                {depotsForPointHub.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="point-name">Nombre</label>
              <Input id="point-name" value={pointName} onChange={(event) => setPointName(event.target.value)} placeholder="Punto Zona Norte" />
            </div>
            <div>
              <label htmlFor="point-city">Ciudad</label>
              <Input id="point-city" value={pointCity} onChange={(event) => setPointCity(event.target.value)} placeholder="Malaga" />
            </div>
            <div>
              <Button type="submit">Crear punto</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hubs</CardTitle>
        </CardHeader>
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
                    <TableCell>{editingHubId === item.id ? <Input value={editingHubName} onChange={(event) => setEditingHubName(event.target.value)} /> : item.name}</TableCell>
                    <TableCell>{editingHubId === item.id ? <Input value={editingHubCity} onChange={(event) => setEditingHubCity(event.target.value)} /> : (item.city ?? '-')}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        {editingHubId === item.id
                          ? <Button type="button" className="btn btn-outline" onClick={saveHub}>Guardar</Button>
                          : <Button type="button" className="btn btn-outline" onClick={() => startEditHub(item)}>Editar</Button>}
                        <Button type="button" className="btn btn-outline" onClick={() => removeHub(item)}>Eliminar</Button>
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
        <CardHeader>
          <CardTitle>Depots</CardTitle>
        </CardHeader>
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
                    <TableCell>{editingDepotId === item.id ? <Input value={editingDepotName} onChange={(event) => setEditingDepotName(event.target.value)} /> : item.name}</TableCell>
                    <TableCell>{editingDepotId === item.id ? <Input value={editingDepotCity} onChange={(event) => setEditingDepotCity(event.target.value)} /> : (item.city ?? '-')}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        {editingDepotId === item.id
                          ? <Button type="button" className="btn btn-outline" onClick={saveDepot}>Guardar</Button>
                          : <Button type="button" className="btn btn-outline" onClick={() => startEditDepot(item)}>Editar</Button>}
                        <Button type="button" className="btn btn-outline" onClick={() => removeDepot(item)}>Eliminar</Button>
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
        <CardHeader>
          <CardTitle>Puntos</CardTitle>
        </CardHeader>
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
                    <TableCell>{editingPointId === item.id ? <Input value={editingPointName} onChange={(event) => setEditingPointName(event.target.value)} /> : item.name}</TableCell>
                    <TableCell>{editingPointId === item.id ? <Input value={editingPointCity} onChange={(event) => setEditingPointCity(event.target.value)} /> : (item.city ?? '-')}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        {editingPointId === item.id
                          ? <Button type="button" className="btn btn-outline" onClick={savePoint}>Guardar</Button>
                          : <Button type="button" className="btn btn-outline" onClick={() => startEditPoint(item)}>Editar</Button>}
                        <Button type="button" className="btn btn-outline" onClick={() => removePoint(item)}>Eliminar</Button>
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
