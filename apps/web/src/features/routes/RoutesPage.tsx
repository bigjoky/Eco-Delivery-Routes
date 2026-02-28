import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { PaginationMeta, RouteSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function RoutesPage() {
  const [items, setItems] = useState<RouteSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const reload = (page: number) =>
    apiClient
      .getRoutes({
        page,
        perPage: meta.per_page,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sort: 'route_date',
        dir: 'desc',
      })
      .then((result) => {
        setItems(result.data);
        setMeta(result.meta);
      });

  useEffect(() => {
    reload(1);
  }, [status, dateFrom, dateTo]);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Rutas</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Paradas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to={`/routes/${item.id}`}>{item.code}</Link>
                    </TableCell>
                    <TableCell>{item.route_date}</TableCell>
                    <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                    <TableCell>{item.stops_count ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <label htmlFor="route-status">Estado</label>
            <select
              id="route-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="planned">planned</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
            </select>
          </div>
          <div className="inline-actions">
            <label htmlFor="route-date-from">Desde</label>
            <input
              id="route-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <label htmlFor="route-date-to">Hasta</label>
            <input
              id="route-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
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
