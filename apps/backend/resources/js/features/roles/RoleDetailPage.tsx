import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AuditLogEntry, RoleDetail } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function RoleDetailPage() {
  const { id = '' } = useParams();
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditEventFilter, setAuditEventFilter] = useState('role.');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showAudit, setShowAudit] = useState(false);

  const load = async () => {
    if (!id) return;
    setError('');
    try {
      const [roleResult, auditResult] = await Promise.all([
        apiClient.getRoleById(id),
        apiClient.getAuditLogs({ resource: 'role', id, event: auditEventFilter.trim() || undefined, page: 1, perPage: 50 }),
      ]);
      setRole(roleResult);
      setSelectedPermissionIds(roleResult.permissions.map((permission) => permission.id));
      setAuditRows(auditResult.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el rol');
    }
  };

  useEffect(() => {
    load();
  }, [id, auditEventFilter]);

  const onTogglePermission = (permissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissionIds((prev) => Array.from(new Set([...prev, permissionId])));
      return;
    }
    setSelectedPermissionIds((prev) => prev.filter((item) => item !== permissionId));
  };

  const onSavePermissions = async () => {
    if (!id) return;
    setError('');
    setMessage('');
    try {
      const updated = await apiClient.updateRolePermissions(id, selectedPermissionIds);
      setRole(updated);
      setSelectedPermissionIds(updated.permissions.map((permission) => permission.id));
      setMessage('Permisos actualizados');
      const refreshedAudit = await apiClient.getAuditLogs({ resource: 'role', id, event: auditEventFilter.trim() || undefined, page: 1, perPage: 50 });
      setAuditRows(refreshedAudit.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron actualizar permisos');
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle de rol</CardTitle>
        </CardHeader>
        <CardContent>
          {!role ? (
            <p className="helper">Cargando...</p>
          ) : (
            <div className="page-grid">
              <div className="kpi-grid">
                <div className="kpi-item"><div className="kpi-label">Rol</div><div className="kpi-value">{role.name}</div></div>
                <div className="kpi-item"><div className="kpi-label">Codigo</div><div className="kpi-value">{role.code}</div></div>
                <div className="kpi-item"><div className="kpi-label">Usuarios</div><div className="kpi-value">{role.users_count}</div></div>
              </div>

              <h3>Permisos asignados</h3>
              <div className="page-grid two">
                {(role.available_permissions ?? role.permissions).map((permission) => (
                  <label key={permission.id} className="inline-actions" htmlFor={`permission-${permission.id}`}>
                    <input
                      id={`permission-${permission.id}`}
                      type="checkbox"
                      checked={selectedPermissionIds.includes(permission.id)}
                      onChange={(event) => onTogglePermission(permission.id, event.target.checked)}
                    />
                    {permission.code}
                  </label>
                ))}
              </div>
              <Button type="button" onClick={onSavePermissions}>Guardar permisos</Button>

              <div className="inline-actions">
                <h3>Auditoría de permisos</h3>
                <Button type="button" variant="outline" onClick={() => setShowAudit((value) => !value)}>
                  {showAudit ? 'Ocultar auditoría' : 'Mostrar auditoría'}
                </Button>
              </div>
              {showAudit ? (
                <>
                  <Input
                    value={auditEventFilter}
                    onChange={(event) => setAuditEventFilter(event.target.value)}
                    placeholder="Filtro evento (ej: role.)"
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
                </>
              ) : null}
            </div>
          )}
          {message && <p className="helper">{message}</p>}
          {error && <p className="helper">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
