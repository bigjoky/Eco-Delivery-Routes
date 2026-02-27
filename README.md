# Eco Delivery Routes Monorepo

Base inicial del sistema multiplataforma de **Eco Delivery Routes**.

## Estructura

- `apps/backend`: backend API (Laravel-style) + pruebas.
- `apps/web`: cliente web React starter.
- `apps/apple`: apps nativas Apple (`macOS`, `iOS/iPadOS`, `tvOS`) y núcleo compartido.
- `apps/android`: app Android nativa (Kotlin + Compose).
- `docs`: ADRs, definición de módulos y arquitectura.
- `.github/workflows`: CI inicial.

## Estrategia técnica inicial

- Repositorio: **monorepo modular**.
- API: REST versionada (`/api/v1`).
- Seguridad: autenticación token + RBAC + auditoría.
- Módulo inicial MVP: **Autenticación + Usuarios + Roles**.

## Flujo Git recomendado

- Trunk-based con ramas cortas: `feature/<modulo>-<tarea>`.
- Commits atómicos con Conventional Commits.
- PR obligatoria con checklist técnico y QA.

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
