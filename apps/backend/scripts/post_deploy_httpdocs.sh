#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$(pwd)}"
PHP_BIN="${PHP_BIN:-php}"

if [[ ! -f "$APP_DIR/artisan" ]]; then
  echo "No se encontró artisan en: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

mkdir -p \
  bootstrap/cache \
  storage/app/public \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/testing \
  storage/framework/views \
  storage/logs

chmod -R 775 bootstrap/cache storage || true

"$PHP_BIN" artisan optimize:clear
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache

if [[ "${RUN_MIGRATIONS:-0}" == "1" ]]; then
  "$PHP_BIN" artisan migrate --force
fi

if [[ -L public/storage || -d public/storage ]]; then
  :
else
  "$PHP_BIN" artisan storage:link || true
fi

echo "Post-deploy completado en $APP_DIR"
