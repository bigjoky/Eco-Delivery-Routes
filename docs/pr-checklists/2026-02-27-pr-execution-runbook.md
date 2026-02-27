# PR Execution Runbook (Layered)

## 0) Configurar remoto (si no existe)

```bash
git remote add origin <URL_DEL_REPO>
git fetch origin
```

## 1) Push rama actual

```bash
git push -u origin codex/monorepo-structure-v1
```

## 2) PR Backend

Incluye commits:
- `feat(quality-api): add top-routes endpoint, exports, and quality RBAC hardening`

Checklist:
- API/OpenAPI actualizada
- tests backend en verde
- cambios RBAC revisados

## 3) PR Web

Incluye commits:
- `feat(web-quality): add exports, risk panel, and expanded audit metadata views`

Checklist:
- `npm run test` y `npm run build` en verde
- filtros/export/riesgo validados en UI

## 4) PR tvOS + Docs

Incluye commits:
- `feat(tvos-monitor): connect route quality API with fallback and update delivery docs`

Checklist:
- build tvOS en verde
- fallback mock validado
- docs de `API_BASE_URL` y `API_TOKEN` revisadas

## 5) Comandos sugeridos para crear PRs (GitHub CLI)

```bash
gh pr create --base main --head codex/monorepo-structure-v1 --title "Backend: Quality API + RBAC hardening" --body-file docs/pr-checklists/2026-02-27-pr-split-quality-ops.md
```

Si prefieres PRs por rama separada, crea ramas desde los commits por capa y usa `cherry-pick`.
