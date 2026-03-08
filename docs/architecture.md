# Arquitectura Inicial

## Decisión de repositorio

Se mantiene **monorepo** y se simplifica a un único runtime de producto:

1. Backend y frontend comparten ciclo de release en el mismo Laravel app.
2. API `/api/v1` y Web/PWA usan exactamente el mismo dominio y RBAC.
3. Menos fricción operativa: un build, un deploy, un pipeline principal.
4. Menor coste de mantenimiento al eliminar apps nativas fuera de alcance.

## Layout actual

- `apps/backend`: Laravel API + React Starter (Inertia) + PWA.
- `docs`: ADRs, diseño funcional y checklists de QA.
- `.github/workflows`: CI para phpunit + vitest/build web.

## Núcleo de dominio (v1)

- Entidades: `User`, `Role`, `Permission`, `AccessToken`, `AuditLog`.
- Entidades operativas: `Shipment`, `Route`, `Incident`, `Partner`, `Vehicle`, `Driver`.
- Estados de usuario: `pending`, `active`, `suspended`.
- Eventos iniciales: `auth.login.succeeded`, `auth.login.failed`, `user.created`, `role.assigned`.

## Contratos y estándares

- API REST versionada: `/api/v1`.
- UI Web/PWA: Inertia (`resources/js/app.tsx` + `resources/js/Pages/*`).
- Errores estandarizados:
  - `AUTH_INVALID_CREDENTIALS` (401)
  - `AUTH_UNAUTHORIZED` (403)
  - `VALIDATION_ERROR` (422)
  - `RESOURCE_NOT_FOUND` (404)
  - `RATE_LIMIT_EXCEEDED` (429)
- Fechas ISO-8601 UTC.
- IDs UUID internos y referencias operativas consecutivas por tipo.
