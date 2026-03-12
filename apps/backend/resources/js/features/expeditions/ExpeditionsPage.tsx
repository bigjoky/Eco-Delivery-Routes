import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import type { ExpeditionDetail, ExpeditionSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function serviceTypeLabel(value?: string | null) {
  if (!value) return '-';
  const labels: Record<string, string> = {
    express_1030: 'Express 10:30',
    express_1400: 'Express 14:00',
    express_1900: 'Express 19:00',
    economy_parcel: 'Economy Parcel',
    business_parcel: 'Business Parcel',
    thermo_parcel: 'Thermo Parcel',
  };
  return labels[value] ?? value;
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function operationKindLabel(value?: 'shipment' | 'return' | null) {
  return value === 'return' ? 'Devolución' : 'Envío';
}

function productCategoryLabel(value?: 'parcel' | 'thermo' | null) {
  return value === 'thermo' ? 'Thermo' : 'Paquetería normal';
}

function legStatusVariant(status?: string | null): 'default' | 'secondary' | 'warning' | 'success' {
  if (status === 'completed' || status === 'delivered') return 'success';
  if (status === 'in_progress' || status === 'out_for_delivery') return 'secondary';
  if (status === 'incident') return 'warning';
  return 'default';
}

function trackingEventLabel(value?: string | null) {
  if (!value) return '-';
  return value.replaceAll('_', ' ').toUpperCase();
}

function yesNoLabel(value?: boolean | null) {
  return value ? 'Sí' : 'No';
}

export function ExpeditionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ExpeditionSummary[]>([]);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [operationKind, setOperationKind] = useState(searchParams.get('operation_kind') ?? '');
  const [legStatus, setLegStatus] = useState(searchParams.get('leg_status') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExpeditionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await apiClient.getExpeditions({
        id: searchParams.get('id') || undefined,
        shipmentId: searchParams.get('shipment_id') || undefined,
        pickupId: searchParams.get('pickup_id') || undefined,
        q: query.trim() || undefined,
        operationKind: (operationKind || undefined) as 'shipment' | 'return' | undefined,
        legStatus: legStatus || undefined,
        limit: 200,
      });
      setItems(rows);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudieron cargar las expediciones.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [searchParams]);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setOperationKind(searchParams.get('operation_kind') ?? '');
    setLegStatus(searchParams.get('leg_status') ?? '');
  }, [searchParams]);

  const summary = useMemo(() => ({
    total: items.length,
    returns: items.filter((item) => item.operation_kind === 'return').length,
    thermo: items.filter((item) => item.product_category === 'thermo').length,
    pickupsPending: items.filter((item) => item.pickup_status !== 'completed').length,
    deliveriesPending: items.filter((item) => item.shipment_status !== 'delivered').length,
  }), [items]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await apiClient.getExpeditionDetail(id);
      setDetail(data);
    } catch (exception) {
      setDetailError(exception instanceof Error ? exception.message : 'No se pudo cargar la expedición.');
    } finally {
      setDetailLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (operationKind) params.set('operation_kind', operationKind);
    if (legStatus) params.set('leg_status', legStatus);
    setSearchParams(params);
  };

  const detailTrackingSummary = useMemo(() => {
    if (!detail) return null;
    const pickupEvents = detail.tracking_events.filter((event) => event.trackable_type === 'pickup');
    const deliveryEvents = detail.tracking_events.filter((event) => event.trackable_type === 'shipment');
    const pickupPods = detail.pods.filter((pod) => pod.evidenceable_type === 'pickup');
    const deliveryPods = detail.pods.filter((pod) => pod.evidenceable_type === 'shipment');
    const pickupIncidents = detail.incidents.filter((incident) => incident.incidentable_type === 'pickup');
    const deliveryIncidents = detail.incidents.filter((incident) => incident.incidentable_type === 'shipment');

    return {
      pickup: {
        events: pickupEvents.length,
        lastEvent: pickupEvents[pickupEvents.length - 1] ?? null,
        pods: pickupPods.length,
        photos: pickupPods.filter((pod) => Boolean(pod.photo_url)).length,
        signatures: pickupPods.filter((pod) => Boolean(pod.signature_name)).length,
        incidentsOpen: pickupIncidents.filter((incident) => !incident.resolved_at).length,
      },
      delivery: {
        events: deliveryEvents.length,
        lastEvent: deliveryEvents[deliveryEvents.length - 1] ?? null,
        pods: deliveryPods.length,
        photos: deliveryPods.filter((pod) => Boolean(pod.photo_url)).length,
        signatures: deliveryPods.filter((pod) => Boolean(pod.signature_name)).length,
        incidentsOpen: deliveryIncidents.filter((incident) => !incident.resolved_at).length,
      },
    };
  }, [detail]);

  return (
    <section className="stack-lg">
      <header className="page-header">
        <div>
          <div className="page-title">Expediciones</div>
          <div className="page-subtitle">Unidad operativa principal. Cada expedición agrupa una pata de recogida y una pata de entrega.</div>
        </div>
      </header>

      <div className="ops-summary-strip">
        <div className="ops-summary-pill"><span>Total</span><strong>{summary.total}</strong></div>
        <div className="ops-summary-pill"><span>Devoluciones</span><strong>{summary.returns}</strong></div>
        <div className="ops-summary-pill"><span>Thermo</span><strong>{summary.thermo}</strong></div>
        <div className="ops-summary-pill"><span>Recogidas pendientes</span><strong>{summary.pickupsPending}</strong></div>
        <div className="ops-summary-pill"><span>Entregas pendientes</span><strong>{summary.deliveriesPending}</strong></div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="page-title">Listado operativo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="filters-panel">
            <div className="inline-actions">
              <div>
                <label htmlFor="expedition-q">Buscar</label>
                <Input id="expedition-q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Expedición, entrega, recogida, remitente, destinatario" />
              </div>
              <div>
                <label htmlFor="expedition-operation">Operación</label>
                <select id="expedition-operation" value={operationKind} onChange={(event) => setOperationKind(event.target.value)}>
                  <option value="">Todas</option>
                  <option value="shipment">Envío</option>
                  <option value="return">Devolución</option>
                </select>
              </div>
              <div>
                <label htmlFor="expedition-leg-status">Estado de pata</label>
                <select id="expedition-leg-status" value={legStatus} onChange={(event) => setLegStatus(event.target.value)}>
                  <option value="">Todos</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="out_for_delivery">Out for delivery</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <Button type="button" onClick={applyFilters} disabled={loading}>{loading ? 'Cargando...' : 'Aplicar filtros'}</Button>
            </div>
          </div>

          {error ? <div className="helper error">{error}</div> : null}

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expedición</TableHead>
                  <TableHead>Operación</TableHead>
                  <TableHead>Recogida</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Remitente</TableHead>
                  <TableHead>Destinatario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="table-row-clickable" onClick={() => void openDetail(item.id)}>
                    <TableCell>
                      <strong>{item.reference}</strong>
                      <div className="helper">{item.external_reference ?? '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div>{operationKindLabel(item.operation_kind)}</div>
                      <div className="helper">{productCategoryLabel(item.product_category)}</div>
                    </TableCell>
                    <TableCell>
                      <div>{item.pickup_reference ?? '-'}</div>
                      <Badge variant={legStatusVariant(item.pickup_status)}>{item.pickup_status ?? '-'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>{item.shipment_reference ?? '-'}</div>
                      <Badge variant={legStatusVariant(item.shipment_status)}>{item.shipment_status ?? '-'}</Badge>
                    </TableCell>
                    <TableCell>{serviceTypeLabel(item.service_type)}</TableCell>
                    <TableCell>{item.sender_name ?? '-'}</TableCell>
                    <TableCell>{item.recipient_name ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <Modal
        open={selectedId !== null}
        onClose={() => {
          setSelectedId(null);
          setDetail(null);
          setDetailError('');
        }}
        title={detail?.expedition.reference ? `Expedición ${detail.expedition.reference}` : 'Detalle de expedición'}
        size="xl"
      >
        {detailLoading ? <div className="helper">Cargando detalle...</div> : null}
        {detailError ? <div className="helper error">{detailError}</div> : null}
        {!detailLoading && !detailError && detail ? (
          <div className="stack-lg">
            <Card>
              <CardHeader><CardTitle className="page-title">Cabecera de expedición</CardTitle></CardHeader>
              <CardContent>
                <div className="kpi-grid">
                  <div><div className="helper">Expedición</div><div>{detail.expedition.reference}</div></div>
                  <div><div className="helper">Operación</div><div>{operationKindLabel(detail.expedition.operation_kind)}</div></div>
                  <div><div className="helper">Producto</div><div>{productCategoryLabel(detail.expedition.product_category)}</div></div>
                  <div><div className="helper">Servicio</div><div>{serviceTypeLabel(detail.expedition.service_type)}</div></div>
                  <div><div className="helper">Programada</div><div>{formatDateTimeLabel(detail.expedition.scheduled_at)}</div></div>
                  <div><div className="helper">Estado</div><div>{detail.expedition.status}</div></div>
                </div>
                {detail.expedition.product_category === 'thermo' ? (
                  <div className="kpi-grid">
                    <div><div className="helper">Rango térmico</div><div>{detail.expedition.temperature_min_c ?? '-'}º / {detail.expedition.temperature_max_c ?? '-'}º</div></div>
                    <div><div className="helper">Log temperatura</div><div>{yesNoLabel(detail.expedition.requires_temperature_log)}</div></div>
                    <div><div className="helper">Notas thermo</div><div>{detail.expedition.thermo_notes ?? '-'}</div></div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="page-grid two">
              <Card>
                <CardHeader><CardTitle className="page-title">Pata de recogida</CardTitle></CardHeader>
                <CardContent>
                  <div className="kpi-grid">
                    <div><div className="helper">Referencia</div><div>{detail.pickup?.reference ?? '-'}</div></div>
                    <div><div className="helper">Estado</div><Badge variant={legStatusVariant(detail.pickup?.status)}>{detail.pickup?.status ?? '-'}</Badge></div>
                    <div><div className="helper">Programada</div><div>{formatDateTimeLabel(detail.pickup?.scheduled_at)}</div></div>
                    <div><div className="helper">Completada</div><div>{formatDateTimeLabel(detail.pickup?.completed_at)}</div></div>
                    <div><div className="helper">Solicitante</div><div>{detail.pickup?.requester_name ?? '-'}</div></div>
                    <div><div className="helper">Dirección</div><div>{detail.pickup?.address_line ?? '-'}</div></div>
                  </div>
                  <div className="kpi-grid">
                    <div><div className="helper">Eventos tracking</div><div>{detailTrackingSummary?.pickup.events ?? 0}</div></div>
                    <div><div className="helper">POD/Evidencias</div><div>{detailTrackingSummary?.pickup.pods ?? 0}</div></div>
                    <div><div className="helper">Incidencias abiertas</div><div>{detailTrackingSummary?.pickup.incidentsOpen ?? 0}</div></div>
                    <div><div className="helper">Último evento</div><div>{detailTrackingSummary?.pickup.lastEvent ? trackingEventLabel(detailTrackingSummary.pickup.lastEvent.event_code) : '-'}</div></div>
                  </div>
                  {detail.pickup?.reference ? (
                    <div className="inline-actions">
                      <Link to={`/expeditions?q=${encodeURIComponent(detail.pickup.reference)}`} className="btn btn-outline">Ver en listado</Link>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="page-title">Pata de entrega</CardTitle></CardHeader>
                <CardContent>
                  <div className="kpi-grid">
                    <div><div className="helper">Referencia</div><div>{detail.shipment?.reference ?? '-'}</div></div>
                    <div><div className="helper">Estado</div><Badge variant={legStatusVariant(detail.shipment?.status)}>{detail.shipment?.status ?? '-'}</Badge></div>
                    <div><div className="helper">Programada</div><div>{formatDateTimeLabel(detail.shipment?.scheduled_at)}</div></div>
                    <div><div className="helper">Completada</div><div>{formatDateTimeLabel(detail.shipment?.delivered_at)}</div></div>
                    <div><div className="helper">Destinatario</div><div>{detail.shipment?.consignee_name ?? '-'}</div></div>
                    <div><div className="helper">Dirección</div><div>{detail.shipment?.address_line ?? '-'}</div></div>
                  </div>
                  <div className="kpi-grid">
                    <div><div className="helper">Eventos tracking</div><div>{detailTrackingSummary?.delivery.events ?? 0}</div></div>
                    <div><div className="helper">POD/Evidencias</div><div>{detailTrackingSummary?.delivery.pods ?? 0}</div></div>
                    <div><div className="helper">Incidencias abiertas</div><div>{detailTrackingSummary?.delivery.incidentsOpen ?? 0}</div></div>
                    <div><div className="helper">Último evento</div><div>{detailTrackingSummary?.delivery.lastEvent ? trackingEventLabel(detailTrackingSummary.delivery.lastEvent.event_code) : '-'}</div></div>
                  </div>
                  {detail.shipment?.reference ? (
                    <div className="inline-actions">
                      <Link to={`/expeditions?q=${encodeURIComponent(detail.shipment.reference)}`} className="btn btn-outline">Ver en listado</Link>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="page-grid two">
              <Card>
                <CardHeader><CardTitle className="page-title">Contactos</CardTitle></CardHeader>
                <CardContent>
                  <div className="stack-md">
                    <div>
                      <div className="helper">Remitente</div>
                      <div>{detail.sender_contact?.display_name ?? detail.sender_contact?.legal_name ?? '-'}</div>
                      <div className="helper">{detail.sender_contact?.document_id ?? '-'} · {detail.sender_contact?.phone ?? '-'}</div>
                    </div>
                    <div>
                      <div className="helper">Destinatario</div>
                      <div>{detail.recipient_contact?.display_name ?? detail.recipient_contact?.legal_name ?? detail.shipment?.consignee_name ?? '-'}</div>
                      <div className="helper">{detail.recipient_contact?.document_id ?? detail.shipment?.consignee_document_id ?? '-'} · {detail.recipient_contact?.phone ?? detail.shipment?.consignee_phone ?? '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="page-title">Timeline operativo</CardTitle></CardHeader>
                <CardContent>
                  {detail.timeline.length === 0 ? <div className="helper">Sin eventos.</div> : (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Pata</TableHead><TableHead>Evento</TableHead><TableHead>Detalle</TableHead><TableHead>Fecha</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.timeline.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.leg === 'pickup' ? 'Recogida' : item.leg === 'delivery' ? 'Entrega' : 'Expedición'}</TableCell>
                              <TableCell>{item.label}</TableCell>
                              <TableCell>{item.detail ?? '-'}</TableCell>
                              <TableCell>{formatDateTimeLabel(item.at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="page-grid two">
              <Card>
                <CardHeader><CardTitle className="page-title">Tracking por pata</CardTitle></CardHeader>
                <CardContent>
                  <div className="kpi-grid">
                    <div><div className="helper">Tracking recogida</div><div>{detailTrackingSummary?.pickup.events ?? 0}</div></div>
                    <div><div className="helper">Tracking entrega</div><div>{detailTrackingSummary?.delivery.events ?? 0}</div></div>
                    <div><div className="helper">Último recogida</div><div>{detailTrackingSummary?.pickup.lastEvent ? trackingEventLabel(detailTrackingSummary.pickup.lastEvent.event_code) : '-'}</div></div>
                    <div><div className="helper">Último entrega</div><div>{detailTrackingSummary?.delivery.lastEvent ? trackingEventLabel(detailTrackingSummary.delivery.lastEvent.event_code) : '-'}</div></div>
                  </div>
                  {detail.tracking_events.length === 0 ? <div className="helper">Sin tracking registrado.</div> : (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Pata</TableHead><TableHead>Evento</TableHead><TableHead>Estado</TableHead><TableHead>Scan</TableHead><TableHead>Fecha</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.tracking_events.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell>{event.trackable_type === 'pickup' ? 'Recogida' : 'Entrega'}</TableCell>
                              <TableCell>{trackingEventLabel(event.event_code)}</TableCell>
                              <TableCell>{event.status_to ?? '-'}</TableCell>
                              <TableCell>{event.scan_code ?? '-'}</TableCell>
                              <TableCell>{formatDateTimeLabel(event.occurred_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="page-title">POD y evidencias</CardTitle></CardHeader>
                <CardContent>
                  <div className="kpi-grid">
                    <div><div className="helper">Firmas recogida</div><div>{detailTrackingSummary?.pickup.signatures ?? 0}</div></div>
                    <div><div className="helper">Fotos recogida</div><div>{detailTrackingSummary?.pickup.photos ?? 0}</div></div>
                    <div><div className="helper">Firmas entrega</div><div>{detailTrackingSummary?.delivery.signatures ?? 0}</div></div>
                    <div><div className="helper">Fotos entrega</div><div>{detailTrackingSummary?.delivery.photos ?? 0}</div></div>
                  </div>
                  {detail.pods.length === 0 ? <div className="helper">Sin evidencias.</div> : (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Pata</TableHead><TableHead>Firma</TableHead><TableHead>Foto</TableHead><TableHead>Capturada</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.pods.map((pod) => (
                            <TableRow key={pod.id}>
                              <TableCell>{pod.evidenceable_type === 'pickup' ? 'Recogida' : 'Entrega'}</TableCell>
                              <TableCell>{pod.signature_name ?? '-'}</TableCell>
                              <TableCell>{pod.photo_url ? 'Sí' : 'No'}</TableCell>
                              <TableCell>{formatDateTimeLabel(pod.captured_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="page-grid two">
              <Card>
                <CardHeader><CardTitle className="page-title">Paradas de ruta</CardTitle></CardHeader>
                <CardContent>
                  {detail.route_stops.length === 0 ? <div className="helper">Sin asignación de ruta.</div> : (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Ruta</TableHead><TableHead>Sec.</TableHead><TableHead>Tipo</TableHead><TableHead>Referencia</TableHead><TableHead>Vinculado</TableHead><TableHead>Estado</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.route_stops.map((stop) => (
                            <TableRow key={stop.id}>
                              <TableCell>{stop.route_id ? <Link to={`/routes/${stop.route_id}`}>Abrir ruta</Link> : '-'}</TableCell>
                              <TableCell>{stop.sequence}</TableCell>
                              <TableCell>{stop.stop_type === 'PICKUP' ? 'Pata de recogida' : 'Pata de entrega'}</TableCell>
                              <TableCell>{stop.reference ?? stop.entity_id}</TableCell>
                              <TableCell>{stop.linked_reference ?? '-'}</TableCell>
                              <TableCell>{stop.status}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="page-title">Incidencias de expedición</CardTitle></CardHeader>
                <CardContent>
                  <div className="kpi-grid">
                    <div><div className="helper">Incidencias</div><div>{detail.incidents.length}</div></div>
                    <div><div className="helper">Paradas de ruta</div><div>{detail.route_stops.length}</div></div>
                    <div><div className="helper">Eventos timeline</div><div>{detail.timeline.length}</div></div>
                    <div><div className="helper">Tracking</div><div>{detail.tracking_events.length}</div></div>
                  </div>
                  <div>
                    <div className="helper">Incidencias vinculadas</div>
                    {detail.incidents.length === 0 ? (
                      <div className="helper">Sin incidencias.</div>
                    ) : (
                      <TableWrapper>
                        <Table>
                          <TableHeader>
                            <TableRow><TableHead>Catálogo</TableHead><TableHead>Pata</TableHead><TableHead>Estado</TableHead><TableHead>Creada</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.incidents.map((incident) => (
                              <TableRow key={incident.id}>
                                <TableCell>{incident.catalog_code}</TableCell>
                                <TableCell>{incident.incidentable_type === 'pickup' ? 'Recogida' : 'Entrega'}</TableCell>
                                <TableCell>{incident.resolved_at ? 'Resuelta' : 'Abierta'}</TableCell>
                                <TableCell>{formatDateTimeLabel(incident.created_at)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableWrapper>
                    )}
                  </div>
                  <div className="inline-actions">
                    <Link to={`/incidents?q=${encodeURIComponent(detail.expedition.reference)}`} className="btn btn-outline">Abrir incidencias</Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
