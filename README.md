# Eco Delivery Routes Monorepo

Base del sistema web/PWA de **Eco Delivery Routes**.

## Estructura

- `apps/backend`: backend Laravel + frontend React (Inertia) + PWA.
- `docs`: ADRs, definición de módulos y arquitectura.
- `.github/workflows`: CI inicial.

## Estrategia técnica inicial

- Repositorio: **monorepo modular**.
- API: REST versionada (`/api/v1`) + capa web con Inertia.
- Seguridad: autenticación token + RBAC + auditoría.
- Módulo inicial MVP: **Autenticación + Usuarios + Roles**.

## Flujo Git recomendado

- Trunk-based con ramas cortas: `codex/<modulo>-<tarea>`.
- Commits atómicos con Conventional Commits.
- PR obligatoria con checklist técnico y QA.
- Proteccion de `main` con checks obligatorios (ver `docs/github-branch-protection.md`).

## Convenciones

- API contracts en `docs/modules` y `apps/backend/openapi.yaml`.
- Toda decisión arquitectónica en `docs/adr`.
- Todo módulo debe incluir:
  - código,
  - tests,
  - documentación,
  - checklist QA.

## Verificacion de release (envios/rutas)

- Ejecutar desde la raiz:
  - `./scripts/verify_release_envios_rutas.sh`

## Desarrollo local

- Backend/API + Web Inertia (2 terminales):
  - `cd apps/backend && php artisan serve`
  - `cd apps/backend && npm run dev`
- OpenAPI:
  - YAML: `http://127.0.0.1:8000/openapi.yaml`
  - Swagger UI: `http://127.0.0.1:8000/api-docs`

## Checklist CI sugerido

- Backend: `./vendor/bin/phpunit` en `apps/backend`.
- Web unit: `npm test` en `apps/backend`.
- Web build/PWA: `npm run build` en `apps/backend`.
