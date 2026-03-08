import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AdvanceSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function AdvancesPage() {
  const [items, setItems] = useState<AdvanceSummary[]>([]);

  useEffect(() => {
    apiClient.getAdvances({ page: 1, perPage: 20 }).then((result) => setItems(result.data));
  }, []);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Anticipos</CardTitle>
          <CardDescription>Listado de anticipos para subcontratas.</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.subcontractor_name ?? item.subcontractor_id}</TableCell>
                    <TableCell>{item.request_date}</TableCell>
                    <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                    <TableCell>{(item.amount_cents / 100).toFixed(2)} {item.currency}</TableCell>
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
