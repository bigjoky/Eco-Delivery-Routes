import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { ShipmentDetail } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function shipmentVariant(status: string): 'default' | 'secondary' | 'warning' | 'success' {
  if (status === 'delivered') return 'success';
  if (status === 'out_for_delivery') return 'secondary';
  if (status === 'incident') return 'warning';
  return 'default';
}

export function ShipmentDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    apiClient
      .getShipmentDetail(id)
      .then((data) => {
        setDetail(data);
      })
      .catch((exception) => {
        setDetail(null);
        setError(exception instanceof Error ? exception.message : 'No se pudo cargar el envio');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const shipment = detail?.shipment;

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle envio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <Link to="/shipments" className="btn btn-outline">Volver</Link>
            {loading ? <span className="helper">Cargando...</span> : null}
            {error ? <span className="helper">{error}</span> : null}
          </div>
          {shipment ? (
            <div className="kpi-grid">
              <div>
                <div className="helper">Referencia</div>
                <div>{shipment.reference}</div>
              </div>
              <div>
                <div className="helper">Estado</div>
                <Badge variant={shipmentVariant(shipment.status)}>{shipment.status}</Badge>
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
    </section>
  );
}
