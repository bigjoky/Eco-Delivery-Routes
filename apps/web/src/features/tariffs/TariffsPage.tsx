import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { TariffSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function TariffsPage() {
  const [items, setItems] = useState<TariffSummary[]>([]);

  useEffect(() => {
    apiClient.getTariffs().then(setItems);
  }, []);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Tarifas</CardTitle>
          <CardDescription>Tarifas separadas para delivery, pickup normal y pickup return.</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Validez</TableHead>
                  <TableHead>Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.service_type}</TableCell>
                    <TableCell>{item.valid_from} {item.valid_to ? `- ${item.valid_to}` : ''}</TableCell>
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
