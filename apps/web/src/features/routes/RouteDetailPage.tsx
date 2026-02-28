import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { RouteStopSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function RouteDetailPage() {
  const { id } = useParams();
  const [stops, setStops] = useState<RouteStopSummary[]>([]);

  useEffect(() => {
    if (!id) return;
    apiClient.getRouteStops(id).then(setStops);
  }, [id]);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Paradas de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Secuencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stops.map((stop) => (
                  <TableRow key={stop.id}>
                    <TableCell>{stop.sequence}</TableCell>
                    <TableCell>{stop.stop_type}</TableCell>
                    <TableCell>{stop.reference ?? stop.entity_id}</TableCell>
                    <TableCell>{stop.entity_type}</TableCell>
                    <TableCell><Badge variant="secondary">{stop.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}
