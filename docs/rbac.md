# RBAC Base v1

## Roles iniciales

1. `super_admin`: control total del sistema.
2. `ops_manager`: gestión operativa y usuarios de su organización.
3. `warehouse_operator`: operación de almacén (lectura/escritura operativa).
4. `courier`: acceso a tareas de ruta asignadas.
5. `viewer`: solo lectura (incluye dashboards tvOS).

## Permisos iniciales

- `auth.login`
- `auth.logout`
- `auth.refresh`
- `users.read`
- `users.create`
- `users.update`
- `users.suspend`
- `roles.read`
- `roles.assign`
- `audit.read`
- `quality.read`
- `quality.read.dashboard`
- `quality.recalculate`
- `quality.export`

## Matriz resumida

- `super_admin`: todos.
- `ops_manager`: `auth.*`, `users.read/create/update`, `roles.read/assign`, `audit.read`.
- `warehouse_operator`: `auth.*`, `users.read` (limitado a su centro).
- `courier`: `auth.*`, `users.read` (solo perfil propio).
- `viewer`: `auth.login/logout`, `users.read` (solo perfil propio).

## Calidad (v1.1)

- `quality.read`: consulta de snapshots KPI.
- `quality.read.dashboard`: lectura de dashboards (web/tvOS) y top-rutas bajo umbral.
- `quality.export`: export CSV/PDF de calidad.
