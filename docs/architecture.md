# Arquitectura Inicial

## Decisión de repositorio

Se adopta **monorepo** por estas razones:

1. Dominio compartido y contratos únicos entre 5 clientes + backend.
2. Evolución coordinada de API y apps sin drift de versiones.
3. Estandarización de calidad (linters, tests, CI, ADRs) en un único pipeline.
4. Menor fricción para cambios transversales de RBAC, workflows y DTOs.

## Layout

- `apps/backend` API Laravel.
- `apps/web` React Starter Kit.
- `apps/apple` apps nativas + core compartido.
- `apps/android` app nativa Android.
- `docs` decisiones y diseño funcional.

## Núcleo de dominio (v1)

- Entidades: `User`, `Role`, `Permission`, `AccessToken`, `AuditLog`.
- Estados de usuario: `pending`, `active`, `suspended`.
- Eventos iniciales: `auth.login.succeeded`, `auth.login.failed`, `user.created`, `role.assigned`.

## Contratos

- API REST versionada: `/api/v1`.
- Errores estandarizados:
  - `AUTH_INVALID_CREDENTIALS` (401)
  - `AUTH_UNAUTHORIZED` (403)
  - `VALIDATION_ERROR` (422)
  - `RESOURCE_NOT_FOUND` (404)
  - `RATE_LIMIT_EXCEEDED` (429)
- Fechas ISO-8601 UTC.
- IDs UUID.
