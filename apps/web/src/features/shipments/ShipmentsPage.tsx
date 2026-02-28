import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { PaginationMeta, ShipmentSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function shipmentVariant(status: string): 'default' | 'secondary' | 'warning' | 'success' {
  if (status === 'delivered') return 'success';
  if (status === 'out_for_delivery') return 'secondary';
  if (status === 'incident') return 'warning';
  return 'default';
}

export function ShipmentsPage() {
  const [items, setItems] = useState<ShipmentSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [status, setStatus] = useState('');

  const reload = (page: number, nextStatus: string = status) =>
    apiClient.getShipments({ page, perPage: meta.per_page, status: nextStatus || undefined }).then((result) => {
      setItems(result.data);
      setMeta(result.meta);
    });

  useEffect(() => {
    reload(1);
  }, [status]);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Envios</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Destinatario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.reference}</TableCell>
                    <TableCell><Badge variant={shipmentVariant(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>{item.consignee_name ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
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
          </div>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => reload(Math.max(1, meta.page - 1))} disabled={meta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {meta.page} / {Math.max(1, meta.last_page || 1)}</span>
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
    </section>
  );
}
