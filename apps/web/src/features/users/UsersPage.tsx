import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { PaginationMeta, RoleSummary, UserSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function UsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, per_page: 10, total: 0, last_page: 0 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'name' | 'email' | 'last_login_at' | 'created_at'>('created_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newStatus, setNewStatus] = useState<'pending' | 'active' | 'suspended'>('active');
  const [newRoleId, setNewRoleId] = useState('');

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'pending' | 'active' | 'suspended'>('active');
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  const loadUsers = async (page = meta.page) => {
    setLoading(true);
    setError('');
    try {
      const result = await apiClient.getUsers({
        q: q || undefined,
        status: status ? (status as 'pending' | 'active' | 'suspended') : undefined,
        sort,
        dir,
        page,
        perPage: meta.per_page,
      });
      setUsers(result.data);
      setMeta(result.meta);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1);
  }, [q, status, sort, dir]);

  useEffect(() => {
    apiClient.getRoles().then(setRoles);
  }, []);

  const onCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiClient.createUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        status: newStatus,
        roleIds: newRoleId ? [newRoleId] : [],
      });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRoleId('');
      setMessage('Usuario creado');
      await loadUsers(1);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el usuario');
    }
  };

  const onOpenEdit = (user: UserSummary) => {
    setEditingUserId(user.id);
    setEditStatus((user.status as 'pending' | 'active' | 'suspended') ?? 'active');
    setEditRoleIds((user.roles ?? []).map((role) => role.id));
  };

  const onSaveEdit = async () => {
    if (!editingUserId) return;
    setError('');
    setMessage('');
    try {
      await apiClient.updateUser(editingUserId, { status: editStatus });
      await apiClient.assignUserRoles(editingUserId, editRoleIds);
      setMessage('Usuario actualizado');
      setEditingUserId(null);
      await loadUsers(meta.page);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el usuario');
    }
  };

  const onToggleRole = (roleId: string, checked: boolean) => {
    if (checked) {
      setEditRoleIds((prev) => Array.from(new Set([...prev, roleId])));
      return;
    }
    setEditRoleIds((prev) => prev.filter((item) => item !== roleId));
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por nombre/email" />
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </Select>
            <Select value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'email' | 'last_login_at' | 'created_at')}>
              <option value="created_at">created_at</option>
              <option value="name">name</option>
              <option value="email">email</option>
              <option value="last_login_at">last_login_at</option>
            </Select>
            <Select value={dir} onChange={(event) => setDir(event.target.value as 'asc' | 'desc')}>
              <option value="desc">desc</option>
              <option value="asc">asc</option>
            </Select>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Ultimo login</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant={user.status === 'active' ? 'success' : 'warning'}>{user.status}</Badge></TableCell>
                    <TableCell>{(user.roles ?? []).map((role) => role.code).join(', ') || '-'}</TableCell>
                    <TableCell>{user.last_login_at ?? '-'}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button type="button" variant="outline" onClick={() => onOpenEdit(user)}>Editar</Button>
                        <Link to={`/users/${user.id}`} className="btn btn-outline">Detalle</Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => loadUsers(Math.max(1, meta.page - 1))} disabled={meta.page <= 1 || loading}>
              Anterior
            </Button>
            <span className="helper">Pagina {meta.page} / {Math.max(1, meta.last_page || 1)}</span>
            <Button type="button" variant="outline" onClick={() => loadUsers(meta.page + 1)} disabled={meta.page >= meta.last_page || loading}>
              Siguiente
            </Button>
          </div>
          <form className="page-grid two" onSubmit={onCreateUser}>
            <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nombre" required />
            <Input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Email" required />
            <Input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Password" type="password" required />
            <Select value={newStatus} onChange={(event) => setNewStatus(event.target.value as 'pending' | 'active' | 'suspended')}>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </Select>
            <Select value={newRoleId} onChange={(event) => setNewRoleId(event.target.value)}>
              <option value="">Sin rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </Select>
            <Button type="submit">Crear usuario</Button>
          </form>
          {editingUserId && (
            <div className="page-grid">
              <h3>Editar usuario</h3>
              <Select value={editStatus} onChange={(event) => setEditStatus(event.target.value as 'pending' | 'active' | 'suspended')}>
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </Select>
              <div className="page-grid two">
                {roles.map((role) => (
                  <label key={role.id} className="inline-actions" htmlFor={`edit-role-${role.id}`}>
                    <input
                      id={`edit-role-${role.id}`}
                      type="checkbox"
                      checked={editRoleIds.includes(role.id)}
                      onChange={(event) => onToggleRole(role.id, event.target.checked)}
                    />
                    {role.name}
                  </label>
                ))}
              </div>
              <div className="inline-actions">
                <Button type="button" onClick={onSaveEdit}>Guardar cambios</Button>
                <Button type="button" variant="outline" onClick={() => setEditingUserId(null)}>Cancelar</Button>
              </div>
            </div>
          )}
          {message && <p className="helper">{message}</p>}
          {error && <p className="helper">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
