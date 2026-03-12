#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/.dist/httpdocs"
BUILD_DIR="$ROOT_DIR/public/build"
POST_DEPLOY_SCRIPT="$ROOT_DIR/scripts/post_deploy_httpdocs.sh"

echo "Eco Delivery Routes :: build httpdocs release"

if [[ ! -d "$ROOT_DIR/vendor" ]]; then
  echo "vendor/ no existe. Ejecuta composer install primero." >&2
  exit 1
fi

if [[ ! -f "$BUILD_DIR/manifest.json" ]]; then
  echo "public/build no existe. Ejecuta npm run build primero." >&2
  exit 1
fi

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

rsync -a \
  --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.DS_Store' \
  --exclude '.idea' \
  --exclude '.phpunit.result.cache' \
  --exclude 'README.md' \
  --exclude 'composer.json' \
  --exclude 'composer.lock' \
  --exclude 'node_modules' \
  --exclude 'package.json' \
  --exclude 'package-lock.json' \
  --exclude 'phpunit.xml' \
  --exclude 'postcss.config.js' \
  --exclude 'tailwind.config.js' \
  --exclude 'tsconfig.json' \
  --exclude 'vite.config.ts' \
  --exclude 'tests' \
  --exclude 'scripts' \
  --exclude 'resources/js' \
  --exclude 'resources/css' \
  --exclude 'storage/logs/*' \
  --exclude 'storage/framework/cache/*' \
  --exclude 'storage/framework/sessions/*' \
  --exclude 'storage/framework/testing/*' \
  --exclude 'storage/framework/views/*' \
  --exclude 'storage/app/private/*' \
  --exclude 'database/*.sqlite' \
  --exclude '.dist' \
  --exclude 'public/hot' \
  --exclude 'public/storage' \
  --exclude 'bootstrap/cache/*.php' \
  "$ROOT_DIR/" "$DIST_DIR/"

mkdir -p \
  "$DIST_DIR/bootstrap/cache" \
  "$DIST_DIR/storage/app/public" \
  "$DIST_DIR/storage/framework/cache/data" \
  "$DIST_DIR/storage/framework/sessions" \
  "$DIST_DIR/storage/framework/testing" \
  "$DIST_DIR/storage/framework/views" \
  "$DIST_DIR/storage/logs"

rm -f "$DIST_DIR/bootstrap/cache/"*.php

if [[ -d "$DIST_DIR/public" ]]; then
  shopt -s dotglob
  cp -R "$DIST_DIR"/public/* "$DIST_DIR"/
  shopt -u dotglob
  rm -rf "$DIST_DIR/public"
fi

cat > "$DIST_DIR/index.php" <<'PHP'
<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

require __DIR__.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
PHP

cat > "$DIST_DIR/.htaccess" <<'HTACCESS'
<IfModule mod_rewrite.c>
    RewriteEngine On

    RewriteCond %{REQUEST_URI} !^/build/
    RewriteCond %{REQUEST_URI} !^/favicon
    RewriteCond %{REQUEST_URI} !^/manifest\.json$
    RewriteCond %{REQUEST_URI} !^/sw\.js$
    RewriteCond %{REQUEST_URI} !^/offline\.html$
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>

<FilesMatch "^(\.env|artisan|composer\.(json|lock)|package(-lock)?\.json|phpunit\.xml|vite\.config\.ts|tailwind\.config\.js|postcss\.config\.js|tsconfig\.json)$">
    Require all denied
</FilesMatch>
HTACCESS

find "$DIST_DIR" -type d -exec chmod 755 {} \;
find "$DIST_DIR" -type f -exec chmod 644 {} \;
chmod 755 "$DIST_DIR/index.php"

if [[ -f "$POST_DEPLOY_SCRIPT" ]]; then
  cp "$POST_DEPLOY_SCRIPT" "$DIST_DIR/.post-deploy.sh"
  chmod 755 "$DIST_DIR/.post-deploy.sh"
fi

echo "Release generado en: $DIST_DIR"
echo "Sube el contenido de esa carpeta a /httpdocs en producción."
