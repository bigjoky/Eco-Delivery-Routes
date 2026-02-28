# MVP-01: Autenticación + Usuarios + Roles

## Alcance

- Login/logout con token.
- Gestión básica de usuarios.
- Asignación y consulta de roles/permisos.
- Auditoría de eventos de autenticación.

## Modelo de datos

- `users`: uuid, name, email, password_hash, status, last_login_at.
- `roles`: uuid, code, name, description.
- `permissions`: uuid, code, name, description.
- `role_permissions`: role_id, permission_id.
- `user_roles`: user_id, role_id.
- `access_tokens`: id, user_id, token_hash, expires_at, revoked_at.
- `audit_logs`: id, actor_user_id, event, metadata(json), created_at.

## Endpoints v1

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{id}`
- `PATCH /api/v1/users/{id}`
- `POST /api/v1/users/{id}/roles`
- `GET /api/v1/roles`

## Pantallas mínimas por plataforma

- Web: Login, listado usuarios, detalle usuario/roles.
- macOS: Login avanzado, consola de usuarios/roles.
- iOS/iPadOS: Login, perfil y gestión básica (según rol).
- Android: Login, perfil y gestión básica (según rol).
- tvOS: Dashboard readonly con usuario actual y estado de sesión.

## QA checklist (mínimo)

- Login válido/inválido.
- Control de acceso por rol en endpoints.
- Validaciones de creación/actualización de usuario.
- Revocación de token en logout.
- Registro de auditoría en login/logout.
