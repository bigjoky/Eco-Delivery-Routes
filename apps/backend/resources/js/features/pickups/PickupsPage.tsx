import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import type { PickupDetail, PickupSummary, ShipmentDetail } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { ShipmentDetailPanel } from '../shipments/ShipmentDetailPanel';

function pickupTypeLabel(value: 'NORMAL' | 'RETURN') {
  return value === 'RETURN' ? 'Devolución' : 'Recogida';
}

function pickupStatusVariant(status: string): 'default' | 'secondary' | 'warning' | 'success' {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'secondary';
  if (status === 'incident') return 'warning';
  return 'default';
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
  };
  return labels[value] ?? value;
}

function toLocalDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PickupsPage() {
  const [items, setItems] = useState<PickupSummary[]>([]);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PickupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [linkedShipmentDetailOpen, setLinkedShipmentDetailOpen] = useState(false);
  const [linkedShipmentDetail, setLinkedShipmentDetail] = useState<ShipmentDetail | null>(null);
  const [linkedShipmentLoading, setLinkedShipmentLoading] = useState(false);
  const [linkedShipmentError, setLinkedShipmentError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await apiClient.getPickups({
        status: status || undefined,
        q: query.trim() || undefined,
        limit: 200,
      });
      setItems(rows);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudieron cargar las recogidas.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const summary = useMemo(() => ({
    total: items.length,
    planned: items.filter((item) => item.status === 'planned').length,
    completed: items.filter((item) => item.status === 'completed').length,
    returns: items.filter((item) => item.pickup_type === 'RETURN').length,
  }), [items]);

  const openDetail = async (pickupId: string) => {
    setSelectedPickupId(pickupId);
    setDetailLoading(true);
    setDetailError('');
    try {
      const detail = await apiClient.getPickupDetail(pickupId);
      setSelectedDetail(detail);
    } catch (exception) {
      setDetailError(exception instanceof Error ? exception.message : 'No se pudo cargar la recogida.');
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openLinkedShipment = async (shipmentId: string) => {
    setLinkedShipmentDetailOpen(true);
    setLinkedShipmentDetail(null);
    setLinkedShipmentLoading(true);
    setLinkedShipmentError('');
    try {
      const detail = await apiClient.getShipmentDetail(shipmentId);
      setLinkedShipmentDetail(detail);
    } catch (exception) {
      setLinkedShipmentError(exception instanceof Error ? exception.message : 'No se pudo cargar el envío enlazado.');
    } finally {
      setLinkedShipmentLoading(false);
    }
  };

  const expeditionTimeline = selectedDetail ? [
    {
      id: 'pickup-scheduled',
      label: 'Recogida programada',
      at: selectedDetail.pickup.scheduled_at,
      detail: selectedDetail.pickup.reference,
    },
    {
      id: 'pickup-completed',
      label: 'Recogida completada',
      at: selectedDetail.pickup.completed_at,
      detail: selectedDetail.pickup.reference,
    },
    ...selectedDetail.tracking_events.map((event) => ({
      id: event.id,
      label: event.event_code,
      at: event.occurred_at,
      detail: event.status_to ?? selectedDetail.linked_shipment?.reference ?? '',
    })),
  ]
    .filter((item) => item.at)
    .sort((a, b) => Date.parse(a.at ?? '') - Date.parse(b.at ?? '')) : [];

  return (
    <section className="stack-lg">
      <header className="page-header">
        <div>
          <div className="page-title">Recogidas</div>
          <div className="page-subtitle">Seguimiento operativo de la pata de recogida dentro de cada expedición.</div>
        </div>
      </header>

      <div className="ops-summary-strip">
        <div className="ops-summary-pill"><span>Total</span><strong>{summary.total}</strong></div>
        <div className="ops-summary-pill"><span>Planificadas</span><strong>{summary.planned}</strong></div>
        <div className="ops-summary-pill"><span>Completadas</span><strong>{summary.completed}</strong></div>
        <div className="ops-summary-pill"><span>Devoluciones</span><strong>{summary.returns}</strong></div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="page-title">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="filters-panel">
            <div className="inline-actions">
              <div>
                <label htmlFor="pickups-q">Buscar</label>
                <Input id="pickups-q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Referencia, expedición, envío o solicitante" />
              </div>
              <div>
                <label htmlFor="pickups-status">Estado</label>
                <select id="pickups-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Todos</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <Button type="button" onClick={() => void load()} disabled={loading}>
                {loading ? 'Cargando...' : 'Aplicar filtros'}
              </Button>
            </div>
          </div>

          {error ? <div className="helper error">{error}</div> : null}

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Expedición</TableHead>
                  <TableHead>Envío</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="table-row-clickable" onClick={() => void openDetail(item.id)}>
                    <TableCell>{item.reference}</TableCell>
                    <TableCell>{item.expedition_reference ?? '-'}</TableCell>
                    <TableCell>{item.shipment_reference ?? '-'}</TableCell>
                    <TableCell>{pickupTypeLabel(item.pickup_type)}</TableCell>
                    <TableCell>{serviceTypeLabel(item.service_type)}</TableCell>
                    <TableCell>{item.requester_name ?? '-'}</TableCell>
                    <TableCell><Badge variant={pickupStatusVariant(item.status)}>{item.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>

          <div className="mobile-ops-list">
            {items.map((item) => (
              <article key={`pickup-mobile-${item.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{item.reference}</strong>
                    <div className="helper">{item.expedition_reference ?? 'Sin expedición'} · {pickupTypeLabel(item.pickup_type)}</div>
                  </div>
                  <Badge variant={pickupStatusVariant(item.status)}>{item.status}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Envío</div>
                    <div>{item.shipment_reference ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Servicio</div>
                    <div>{serviceTypeLabel(item.service_type)}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Solicitante</div>
                    <div>{item.requester_name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Programada</div>
                    <div>{toLocalDateTime(item.scheduled_at)}</div>
                  </div>
                </div>
                <div className="mobile-ops-card-actions">
                  <Button type="button" onClick={() => void openDetail(item.id)}>Ver detalle</Button>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={selectedPickupId !== null}
        onClose={() => {
          setSelectedPickupId(null);
          setSelectedDetail(null);
          setDetailError('');
        }}
        title={selectedDetail?.pickup.reference ? `Recogida ${selectedDetail.pickup.reference}` : 'Detalle de recogida'}
        size="xl"
      >
        {detailLoading ? <div className="helper">Cargando detalle...</div> : null}
        {detailError ? <div className="helper error">{detailError}</div> : null}
        {!detailLoading && !detailError && selectedDetail ? (
          <div className="stack-lg">
            <Card>
              <CardHeader>
                <CardTitle className="page-title">Circuito de servicio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="kpi-grid">
                  <div><div className="helper">Expedición</div><div>{selectedDetail.expedition?.reference ?? '-'}</div></div>
                  <div><div className="helper">Envío enlazado</div><div>{selectedDetail.linked_shipment?.reference ?? '-'}</div></div>
                  <div><div className="helper">Operación</div><div>{selectedDetail.expedition?.operation_kind === 'return' ? 'Devolución' : 'Envío'}</div></div>
                  <div><div className="helper">Producto</div><div>{selectedDetail.expedition?.product_category === 'thermo' ? 'Thermo' : 'Paquetería normal'}</div></div>
                  <div><div className="helper">Servicio</div><div>{serviceTypeLabel(selectedDetail.pickup.service_type ?? selectedDetail.expedition?.service_type)}</div></div>
                  <div><div className="helper">Estado</div><Badge variant={pickupStatusVariant(selectedDetail.pickup.status)}>{selectedDetail.pickup.status}</Badge></div>
                </div>
                {selectedDetail.linked_shipment?.id ? (
                  <div className="inline-actions">
                    <Button type="button" variant="outline" onClick={() => void openLinkedShipment(selectedDetail.linked_shipment!.id)}>
                      Abrir envío enlazado
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="page-grid two">
              <Card>
                <CardHeader><CardTitle className="page-title">Datos de recogida</CardTitle></CardHeader>
                <CardContent>
                  <div className="kpi-grid">
                    <div><div className="helper">Referencia</div><div>{selectedDetail.pickup.reference}</div></div>
                    <div><div className="helper">Tipo</div><div>{pickupTypeLabel(selectedDetail.pickup.pickup_type)}</div></div>
                    <div><div className="helper">Solicitante</div><div>{selectedDetail.pickup.requester_name ?? '-'}</div></div>
                    <div><div className="helper">Programada</div><div>{toLocalDateTime(selectedDetail.pickup.scheduled_at)}</div></div>
                    <div><div className="helper">Completada</div><div>{toLocalDateTime(selectedDetail.pickup.completed_at)}</div></div>
                    <div><div className="helper">Dirección</div><div>{selectedDetail.pickup.address_line ?? '-'}</div></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="page-title">Contactos</CardTitle></CardHeader>
                <CardContent>
                  <div className="stack-md">
                    <div>
                      <div className="helper">Remitente</div>
                      <div>{selectedDetail.sender_contact?.display_name ?? selectedDetail.sender_contact?.legal_name ?? '-'}</div>
                      <div className="helper">{selectedDetail.sender_contact?.phone ?? '-'} · {selectedDetail.sender_contact?.document_id ?? '-'}</div>
                    </div>
                    <div>
                      <div className="helper">Destinatario</div>
                      <div>{selectedDetail.recipient_contact?.display_name ?? selectedDetail.recipient_contact?.legal_name ?? '-'}</div>
                      <div className="helper">{selectedDetail.recipient_contact?.phone ?? '-'} · {selectedDetail.recipient_contact?.document_id ?? '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="page-grid two">
              <Card>
                <CardHeader><CardTitle className="page-title">Timeline de expedición</CardTitle></CardHeader>
                <CardContent>
                  {expeditionTimeline.length === 0 ? <div className="helper">Sin eventos operativos.</div> : (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Evento</TableHead><TableHead>Detalle</TableHead><TableHead>Fecha</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {expeditionTimeline.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell>{event.label}</TableCell>
                              <TableCell>{event.detail || '-'}</TableCell>
                              <TableCell>{toLocalDateTime(event.at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="page-title">Tracking</CardTitle></CardHeader>
                <CardContent>
                  {selectedDetail.tracking_events.length === 0 ? <div className="helper">Sin eventos.</div> : (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Evento</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDetail.tracking_events.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell>{event.event_code}</TableCell>
                              <TableCell>{event.status_to ?? '-'}</TableCell>
                              <TableCell>{toLocalDateTime(event.occurred_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="page-title">Rutas asociadas</CardTitle></CardHeader>
                <CardContent>
                  {selectedDetail.route_stops.length === 0 ? <div className="helper">No asignada a ruta.</div> : (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Ruta</TableHead><TableHead>Secuencia</TableHead><TableHead>Estado</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDetail.route_stops.map((stop) => (
                            <TableRow key={stop.id}>
                              <TableCell>{stop.route_code ?? stop.route_id}</TableCell>
                              <TableCell>{stop.sequence}</TableCell>
                              <TableCell>{stop.status}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={linkedShipmentDetailOpen}
        onClose={() => {
          setLinkedShipmentDetailOpen(false);
          setLinkedShipmentDetail(null);
          setLinkedShipmentError('');
        }}
        title={linkedShipmentDetail?.shipment.reference ? `Envío enlazado · ${linkedShipmentDetail.shipment.reference}` : 'Envío enlazado'}
        size="xl"
      >
        <ShipmentDetailPanel
          detail={linkedShipmentDetail}
          loading={linkedShipmentLoading}
          error={linkedShipmentError}
        />
      </Modal>
    </section>
  );
}
