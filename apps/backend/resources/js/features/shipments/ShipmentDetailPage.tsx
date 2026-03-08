import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityActivityTimeline } from '../../components/audit/EntityActivityTimeline';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { IncidentCatalogItem, IncidentSummary, ShipmentDetail } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

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

export function ShipmentDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [incidentCatalog, setIncidentCatalog] = useState<IncidentCatalogItem[]>([]);
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);
  const [newIncidentCode, setNewIncidentCode] = useState('');
  const [newIncidentCategory, setNewIncidentCategory] = useState<'failed' | 'absent' | 'retry' | 'general'>('general');
  const [newIncidentNotes, setNewIncidentNotes] = useState('');
  const [editingIncident, setEditingIncident] = useState<IncidentSummary | null>(null);
  const [editIncidentCode, setEditIncidentCode] = useState('');
  const [editIncidentCategory, setEditIncidentCategory] = useState<'failed' | 'absent' | 'retry' | 'general'>('general');
  const [editIncidentNotes, setEditIncidentNotes] = useState('');
  const [incidentSaving, setIncidentSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiClient.getShipmentDetail(id);
        setDetail(data);
      } catch (exception) {
        setDetail(null);
        setError(exception instanceof Error ? exception.message : 'No se pudo cargar el envio');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    apiClient.getIncidentCatalog().then((items) => {
      setIncidentCatalog(items);
      if (!newIncidentCode && items.length > 0) {
        setNewIncidentCode(items[0].code);
        setNewIncidentCategory(items[0].category);
      }
    }).catch(() => setIncidentCatalog([]));
  }, []);

  const shipment = detail?.shipment;

  const resolveIncident = async (incidentId: string) => {
    if (!id) return;
    setResolvingId(incidentId);
    setError('');
    try {
      await apiClient.resolveIncident(incidentId, 'Resuelta desde detalle de envio');
      const refreshed = await apiClient.getShipmentDetail(id);
      setDetail(refreshed);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo resolver la incidencia');
    } finally {
      setResolvingId(null);
    }
  };

  const shipmentIncidentCatalog = incidentCatalog.filter((item) => item.applies_to === 'shipment' || item.applies_to === 'both');

  const createIncidentFromDetail = async () => {
    if (!id || !newIncidentCode) return;
    setIncidentSaving(true);
    setError('');
    try {
      await apiClient.createIncident({
        incidentable_type: 'shipment',
        incidentable_id: id,
        catalog_code: newIncidentCode,
        category: newIncidentCategory,
        notes: newIncidentNotes || undefined,
      });
      setNewIncidentNotes('');
      setNewIncidentOpen(false);
      const refreshed = await apiClient.getShipmentDetail(id);
      setDetail(refreshed);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo crear la incidencia');
    } finally {
      setIncidentSaving(false);
    }
  };

  const openEditIncident = (incident: IncidentSummary) => {
    setEditingIncident(incident);
    setEditIncidentCode(incident.catalog_code);
    setEditIncidentCategory(incident.category);
    setEditIncidentNotes(incident.notes ?? '');
  };

  const saveEditIncident = async () => {
    if (!id || !editingIncident) return;
    setIncidentSaving(true);
    setError('');
    try {
      await apiClient.updateIncident(editingIncident.id, {
        catalog_code: editIncidentCode,
        category: editIncidentCategory,
        notes: editIncidentNotes,
      });
      setEditingIncident(null);
      const refreshed = await apiClient.getShipmentDetail(id);
      setDetail(refreshed);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo actualizar la incidencia');
    } finally {
      setIncidentSaving(false);
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle envio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <Link to="/dashboard" className="helper">Dashboard</Link>
            <span className="helper">/</span>
            <Link to="/shipments" className="btn btn-outline">Volver</Link>
            {shipment?.route_id ? (
              <Link to={`/routes/${shipment.route_id}`} className="btn btn-outline">Ir a ruta</Link>
            ) : null}
            <Link to={`/incidents?incidentable_id=${encodeURIComponent(id ?? '')}`} className="btn btn-outline">Ver incidencias relacionadas</Link>
            {loading ? <span className="helper">Cargando...</span> : null}
            {error ? <span className="helper">{error}</span> : null}
          </div>
          {shipment ? (
            <div className="kpi-grid">
              <div>
                <div className="helper">Referencia</div>
                <div>{shipment.reference}</div>
                <div className="helper">ID: {shipment.id}</div>
              </div>
              <div>
                <div className="helper">Referencia externa</div>
                <div>{shipment.external_reference ?? '-'}</div>
              </div>
              <div>
                <div className="helper">Estado</div>
                <Badge variant={shipmentVariant(shipment.status)} title={shipmentStatusHelp(shipment.status)}>
                  {shipment.status}
                </Badge>
              </div>
              <div>
                <div className="helper">Servicio</div>
                <div title={shipment.service_type ?? ''}>{serviceTypeLabel(shipment.service_type)}</div>
              </div>
              <div>
                <div className="helper">Destinatario</div>
                <div>{shipment.consignee_name ?? '-'}</div>
              </div>
              <div>
                <div className="helper">Direccion</div>
                <div>{shipment.address_line ?? '-'}</div>
              </div>
              <div>
                <div className="helper">Programado</div>
                <div>{shipment.scheduled_at ?? '-'}</div>
              </div>
              <div>
                <div className="helper">Entregado</div>
                <div>{shipment.delivered_at ?? '-'}</div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Scan</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.tracking_events?.length ? detail.tracking_events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.event_code}</TableCell>
                    <TableCell>{event.status_to ?? '-'}</TableCell>
                    <TableCell>{event.scan_code ?? '-'}</TableCell>
                    <TableCell>{event.source ?? '-'}</TableCell>
                    <TableCell>{event.occurred_at ?? '-'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5}>Sin eventos</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">POD</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Capturado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.pods?.length ? detail.pods.map((pod) => (
                  <TableRow key={pod.id}>
                    <TableCell>{pod.signature_name ?? '-'}</TableCell>
                    <TableCell>{pod.photo_url ? 'Disponible' : '-'}</TableCell>
                    <TableCell>{pod.captured_at ?? '-'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3}>Sin POD</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Incidencias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <Button type="button" onClick={() => setNewIncidentOpen(true)}>
              Nueva incidencia
            </Button>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Resuelto</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.incidents?.length ? detail.incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>{incident.category}</TableCell>
                    <TableCell>{incident.catalog_code}</TableCell>
                    <TableCell>{incident.notes ?? '-'}</TableCell>
                    <TableCell>{incident.created_at ?? '-'}</TableCell>
                    <TableCell>{incident.resolved_at ?? '-'}</TableCell>
                    <TableCell>
                      {incident.resolved_at ? (
                        <span className="helper">Resuelta</span>
                      ) : (
                        <div className="inline-actions">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openEditIncident(incident)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={resolvingId === incident.id}
                            onClick={() => resolveIncident(incident.id)}
                          >
                            {resolvingId === incident.id ? 'Resolviendo...' : 'Resolver'}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6}>Sin incidencias</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Paradas</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Secuencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Completado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.route_stops?.length ? detail.route_stops.map((stop) => (
                  <TableRow key={stop.id}>
                    <TableCell>
                      {stop.route_id ? <Link to={`/routes/${stop.route_id}`}>{stop.route_code ?? stop.route_id}</Link> : '-'}
                    </TableCell>
                    <TableCell>{stop.route_date ?? '-'}</TableCell>
                    <TableCell>{stop.sequence}</TableCell>
                    <TableCell>{stop.stop_type}</TableCell>
                    <TableCell>{stop.status}</TableCell>
                    <TableCell>{stop.planned_at ?? '-'}</TableCell>
                    <TableCell>{stop.completed_at ?? '-'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7}>Sin paradas asociadas</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => setShowAudit((value) => !value)}>
            {showAudit ? 'Ocultar auditoría' : 'Mostrar auditoría'}
          </Button>
        </CardContent>
      </Card>
      {showAudit ? (
        <EntityActivityTimeline
          title="Actividad del envío"
          resource="shipment"
          entityId={shipment?.id ?? id}
          eventPrefix="shipments."
        />
      ) : null}
      <Modal
        open={newIncidentOpen}
        title="Nueva incidencia del envío"
        onClose={() => setNewIncidentOpen(false)}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setNewIncidentOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={createIncidentFromDetail} disabled={incidentSaving || !newIncidentCode}>
              {incidentSaving ? 'Guardando...' : 'Crear incidencia'}
            </Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label htmlFor="detail-incident-catalog">Catálogo</label>
            <Select
              id="detail-incident-catalog"
              value={newIncidentCode}
              onChange={(event) => {
                const selected = shipmentIncidentCatalog.find((item) => item.code === event.target.value);
                setNewIncidentCode(event.target.value);
                if (selected) setNewIncidentCategory(selected.category);
              }}
            >
              {shipmentIncidentCatalog.map((item) => (
                <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="detail-incident-category">Categoría</label>
            <Input id="detail-incident-category" value={newIncidentCategory} readOnly />
          </div>
          <div>
            <label htmlFor="detail-incident-notes">Notas</label>
            <Input id="detail-incident-notes" value={newIncidentNotes} onChange={(event) => setNewIncidentNotes(event.target.value)} placeholder="Detalle operativo" />
          </div>
        </div>
      </Modal>
      <Modal
        open={editingIncident !== null}
        title="Editar incidencia"
        onClose={() => setEditingIncident(null)}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setEditingIncident(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveEditIncident} disabled={incidentSaving || !editingIncident}>
              {incidentSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label htmlFor="detail-incident-edit-catalog">Catálogo</label>
            <Select
              id="detail-incident-edit-catalog"
              value={editIncidentCode}
              onChange={(event) => {
                const selected = shipmentIncidentCatalog.find((item) => item.code === event.target.value);
                setEditIncidentCode(event.target.value);
                if (selected) setEditIncidentCategory(selected.category);
              }}
            >
              {shipmentIncidentCatalog.map((item) => (
                <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="detail-incident-edit-category">Categoría</label>
            <Input id="detail-incident-edit-category" value={editIncidentCategory} readOnly />
          </div>
          <div>
            <label htmlFor="detail-incident-edit-notes">Notas</label>
            <Input id="detail-incident-edit-notes" value={editIncidentNotes} onChange={(event) => setEditIncidentNotes(event.target.value)} placeholder="Detalle operativo" />
          </div>
        </div>
      </Modal>
    </section>
  );
}
