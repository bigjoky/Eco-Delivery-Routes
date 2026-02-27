# PR Execution Runbook (Layered)

## 0) Configurar remoto (si no existe)

```bash
git remote add origin <URL_DEL_REPO>
git fetch origin
```

Validar:

```bash
git remote -v
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

## 6) Split recomendado en 3 PRs (opcional, más limpio)

Commits candidatos:
- `36161b4` (quality API + web risk + RBAC approvals)
- `7edc7f5` (CI Apple + SharedCore tests)

Ejemplo:

```bash
git checkout -b codex/pr-backend-quality
git cherry-pick 36161b4
git push -u origin codex/pr-backend-quality
gh pr create --base main --head codex/pr-backend-quality --title "Backend: quality risk summary + RBAC approvals" --body "Incluye endpoint risk-summary, OpenAPI y tests."
```

```bash
git checkout main
git checkout -b codex/pr-ci-apple
git cherry-pick 7edc7f5
git push -u origin codex/pr-ci-apple
gh pr create --base main --head codex/pr-ci-apple --title "CI: apple matrix + SharedCore tests" --body "Agrega swift test de SharedCore y build matrix iOS/macOS/tvOS."
```
