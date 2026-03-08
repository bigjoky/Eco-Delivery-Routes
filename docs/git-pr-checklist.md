# Git Strategy + PR Checklist

## Estrategia de ramas
- Modelo: trunk-based con ramas cortas prefijo `codex/`.
- Naming: `codex/<modulo>-<scope>`.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`).

## Flujo
1. Crear rama desde `main`.
2. Commits atómicos por capa (`backend`, `web-pwa`, `docs`).
3. Abrir PR con checklist obligatoria.
4. Review técnico + QA.
5. Merge `--no-ff`.

## PR Checklist
- [ ] Migraciones y seeders incluidos (si aplica).
- [ ] Endpoints versionados `/api/v1` y OpenAPI actualizada.
- [ ] RBAC/policies cubiertos.
- [ ] Tests pasan (`phpunit`, `vitest`, `npm run build`).
- [ ] No hay secretos en código.
- [ ] Docs/ADR/Blueprint actualizados.
- [ ] QA funcional mínimo ejecutado en la feature.
