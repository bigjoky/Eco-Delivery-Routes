# Staging Plan - Limpieza de Untracked

Objetivo: convertir el estado actual en commits pequenos y revisables, evitando mezclar bootstrap/base con cambios funcionales.

## 1) Commit de higiene

- Archivos:
  - `.gitignore`
  - `scripts/verify_release_envios_rutas.sh`
  - `docs/pr-envios-rutas-cierre.md`
  - `docs/pr-checklist-envios-rutas.md`
  - `docs/staging-plan-untracked.md`

Comando sugerido:

```bash
git add .gitignore scripts/verify_release_envios_rutas.sh docs/pr-envios-rutas-cierre.md docs/pr-checklist-envios-rutas.md docs/staging-plan-untracked.md
git commit -m "chore: add release verification script and staging documentation"
```

## 2) Commit app por app

- `apps/backend/**` en un commit funcional.
- `apps/web/**` en un commit funcional.
- `apps/android/**` en un commit funcional.
- `apps/apple/**` en un commit funcional.

Comando base por app:

```bash
git add apps/<app>
git commit -m "feat(<app>): <resumen corto>"
```

## 3) Excluir artefactos antes de stage

Verificar que no entren artefactos locales:

- `.gradle-user-home/`
- `apps/**/build/`
- `apps/web/.vite/`
- `apps/apple/SharedCore/.build/`
- `apps/backend/.phpunit.result.cache`
- `apps/backend/database/*.sqlite`

## 4) Gate de release antes de push

```bash
./scripts/verify_release_envios_rutas.sh
```

Si todo pasa, hacer push y abrir PR.
