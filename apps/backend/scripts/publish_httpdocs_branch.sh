#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
BRANCH="${1:-codex/httpdocs-release}"
WORKTREE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/eco-httpdocs-XXXXXX")"

cleanup() {
  git -C "$REPO_ROOT" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$ROOT_DIR/scripts/build_httpdocs_release.sh"

git -C "$REPO_ROOT" worktree add --detach "$WORKTREE_DIR" HEAD >/dev/null

cd "$WORKTREE_DIR"
git checkout --orphan "$BRANCH" >/dev/null 2>&1 || git checkout -B "$BRANCH" >/dev/null 2>&1

find "$WORKTREE_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
rsync -a "$ROOT_DIR/.dist/httpdocs/" "$WORKTREE_DIR/"

git add -A

if git diff --cached --quiet; then
  echo "No hay cambios para publicar en $BRANCH"
  exit 0
fi

git commit -m "build: publish httpdocs release" >/dev/null
git push -f origin "$BRANCH"

echo "Branch de despliegue actualizado: $BRANCH"
