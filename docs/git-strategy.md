# Git Strategy

## Modelo

Trunk-based development con ramas cortas:

- `main`: siempre desplegable.
- `feature/<scope>-<short-name>`: cambios de módulo/feature.
- `hotfix/<scope>-<short-name>`: correcciones urgentes.

## Reglas

1. Commits atómicos con Conventional Commits.
2. PR obligatoria con revisión técnica.
3. CI verde (lint + tests + build) antes de merge.
4. Squash merge permitido manteniendo referencia al ticket.

## Plantilla de commits

- `feat(auth): add login endpoint`
- `fix(rbac): enforce role guard on users index`
- `test(api): cover register validation`
- `docs(adr): record monorepo decision`
