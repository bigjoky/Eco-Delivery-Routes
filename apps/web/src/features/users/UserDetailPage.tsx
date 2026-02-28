import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AuditLogEntry, UserSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditEventFilter, setAuditEventFilter] = useState('user.');
  const [error, setError] = useState('');

  const load = async () => {
    if (!id) return;
    setError('');
    try {
      const [userResult, auditResult] = await Promise.all([
        apiClient.getUserById(id),
        apiClient.getAuditLogs({
          resource: 'user',
          id,
          event: auditEventFilter.trim() || undefined,
          page: 1,
          perPage: 50,
        }),
      ]);
      setUser(userResult);
      setAuditRows(auditResult.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el usuario');
    }
  };

  useEffect(() => {
    load();
  }, [id, auditEventFilter]);

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle de usuario</CardTitle>
        </CardHeader>
        <CardContent>
          {!user ? (
            <p className="helper">Cargando...</p>
          ) : (
            <div className="page-grid">
              <div className="kpi-grid">
                <div className="kpi-item"><div className="kpi-label">Nombre</div><div className="kpi-value">{user.name}</div></div>
                <div className="kpi-item"><div className="kpi-label">Email</div><div className="kpi-value">{user.email}</div></div>
                <div className="kpi-item"><div className="kpi-label">Estado</div><div className="kpi-value">{user.status}</div></div>
                <div className="kpi-item"><div className="kpi-label">Roles</div><div className="kpi-value">{(user.roles ?? []).map((r) => r.code).join(', ') || '-'}</div></div>
              </div>
              <Input
                value={auditEventFilter}
                onChange={(event) => setAuditEventFilter(event.target.value)}
                placeholder="Filtro evento (ej: user.)"
              />
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Metadata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.created_at}</TableCell>
                        <TableCell>{row.event}</TableCell>
                        <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                        <TableCell>{typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata ?? {})}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </div>
          )}
          {error && <p className="helper">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
