import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import type { ShipmentDetail } from '../../core/api/types';

const shipmentDetailSectionIds = {
  summary: 'shipment-detail-summary',
  tracking: 'shipment-detail-tracking',
  pod: 'shipment-detail-pod',
  incidents: 'shipment-detail-incidents',
  stops: 'shipment-detail-stops',
} as const;

function scrollToShipmentDetailSection(sectionId: string) {
  if (typeof document === 'undefined') return;
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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

export function ShipmentDetailPanel({
  detail,
  loading,
  error,
  onOpenIncidents,
}: {
  detail: ShipmentDetail | null;
  loading: boolean;
  error: string;
  onOpenIncidents?: () => void;
}) {
  const shipment = detail?.shipment;

  return (
    <div className="page-grid">
      <div className="ops-summary-strip">
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Referencia</div>
          <div className="ops-summary-value">{shipment?.reference ?? '-'}</div>
          <div className="ops-summary-caption">Externa {shipment?.external_reference ?? '-'}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Estado</div>
          <div className="ops-summary-value">{shipment?.status ?? '-'}</div>
          <div className="ops-summary-caption">Servicio {serviceTypeLabel(shipment?.service_type)}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Programado</div>
          <div className="ops-summary-value">{shipment?.scheduled_at ?? '-'}</div>
          <div className="ops-summary-caption">Entregado {shipment?.delivered_at ?? '-'}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Incidencias</div>
          <div className="ops-summary-value">{detail?.incidents?.length ?? 0}</div>
          <div className="ops-summary-caption">Eventos {detail?.tracking_events?.length ?? 0} · POD {detail?.pods?.length ?? 0}</div>
        </div>
      </div>

      <div className="inline-actions ops-toolbar">
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.summary)}>
          Ficha
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.tracking)}>
          Tracking
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.pod)}>
          POD
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.incidents)}>
          Incidencias
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.stops)}>
          Paradas
        </Button>
        {shipment?.route_id ? <Link to={`/routes/${shipment.route_id}`} className="btn btn-outline">Ir a ruta</Link> : null}
        {shipment ? <Link to={`/shipments/${shipment.id}`} className="btn btn-outline">Abrir página completa</Link> : null}
        {onOpenIncidents ? (
          <Button type="button" variant="outline" onClick={onOpenIncidents}>
            Incidencias relacionadas
          </Button>
        ) : null}
        {loading ? <span className="helper">Cargando detalle...</span> : null}
        {error ? <span className="helper error">{error}</span> : null}
      </div>

      <Card id={shipmentDetailSectionIds.summary}>
        <CardHeader>
          <CardTitle className="page-title">Ficha del envío</CardTitle>
        </CardHeader>
        <CardContent>
          {shipment ? (
            <div className="kpi-grid">
              <div>
                <div className="helper">ID</div>
                <div>{shipment.id}</div>
              </div>
              <div>
                <div className="helper">Estado</div>
                <Badge variant={shipmentVariant(shipment.status)} title={shipmentStatusHelp(shipment.status)}>
                  {shipment.status}
                </Badge>
              </div>
              <div>
                <div className="helper">Servicio</div>
                <div>{serviceTypeLabel(shipment.service_type)}</div>
              </div>
              <div>
                <div className="helper">Hub</div>
                <div>{shipment.hub_code ?? shipment.hub_id ?? '-'}</div>
              </div>
              <div>
                <div className="helper">Destinatario</div>
                <div>{shipment.consignee_name ?? '-'}</div>
              </div>
              <div>
                <div className="helper">Dirección</div>
                <div>{shipment.address_line ?? '-'}</div>
              </div>
            </div>
          ) : (
            <div className="helper">{loading ? 'Cargando...' : 'No se pudo cargar el envío.'}</div>
          )}
        </CardContent>
      </Card>

      <div className="page-grid two">
        <Card>
          <CardHeader>
            <CardTitle className="page-title">Contacto destinatario</CardTitle>
          </CardHeader>
          <CardContent>
            {shipment ? (
              <div className="kpi-grid">
                <div>
                  <div className="helper">Nombre</div>
                  <div>{shipment.consignee_name ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Documento</div>
                  <div>{shipment.consignee_document_id ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Teléfono</div>
                  <div>{shipment.consignee_phone ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Email</div>
                  <div>{shipment.consignee_email ?? '-'}</div>
                </div>
              </div>
            ) : (
              <div className="helper">Sin datos de contacto.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="page-title">Dirección operativa</CardTitle>
          </CardHeader>
          <CardContent>
            {shipment ? (
              <div className="kpi-grid">
                <div>
                  <div className="helper">Calle</div>
                  <div>{shipment.address_street ?? shipment.address_line ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Número</div>
                  <div>{shipment.address_number ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Código postal</div>
                  <div>{shipment.postal_code ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Ciudad / Provincia</div>
                  <div>{[shipment.city, shipment.province].filter(Boolean).join(' · ') || '-'}</div>
                </div>
                <div>
                  <div className="helper">País</div>
                  <div>{shipment.country ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Notas</div>
                  <div>{shipment.address_notes ?? '-'}</div>
                </div>
              </div>
            ) : (
              <div className="helper">Sin dirección disponible.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="page-grid two">
        <Card id={shipmentDetailSectionIds.tracking}>
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
        <Card id={shipmentDetailSectionIds.pod}>
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
      </div>

      <div className="page-grid two">
        <Card id={shipmentDetailSectionIds.incidents}>
          <CardHeader>
            <CardTitle className="page-title">Incidencias</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail?.incidents?.length ? detail.incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>{incident.category}</TableCell>
                      <TableCell>{incident.catalog_code}</TableCell>
                      <TableCell>{incident.notes ?? '-'}</TableCell>
                      <TableCell>{incident.resolved_at ? 'Resuelta' : 'Abierta'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4}>Sin incidencias</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
        <Card id={shipmentDetailSectionIds.stops}>
          <CardHeader>
            <CardTitle className="page-title">Paradas</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Secuencia</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail?.route_stops?.length ? detail.route_stops.map((stop) => (
                    <TableRow key={stop.id}>
                      <TableCell>{stop.route_code ?? stop.route_id ?? '-'}</TableCell>
                      <TableCell>{stop.sequence}</TableCell>
                      <TableCell>{stop.stop_type}</TableCell>
                      <TableCell>{stop.status}</TableCell>
                      <TableCell>{stop.planned_at ?? '-'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5}>Sin paradas asociadas</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
