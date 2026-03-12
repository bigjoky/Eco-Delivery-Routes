# Backend API (Laravel Skeleton)

Estructura inicial compatible con Laravel para el módulo MVP-01.

## Próximo setup real

1. `composer install`
2. `cp .env.example .env`
3. `php artisan key:generate`
4. `php artisan migrate --seed`
5. `./vendor/bin/phpunit -c phpunit.xml`

## Módulos incluidos (skeleton)

- AuthController (`login`, `logout`, `me`, `refresh`)
- UserController (`index`, `store`, `show`, `update`, `assignRoles`)
- RoleController (`index`)
- Policies y Requests base
- Migraciones y seeders iniciales
- Pruebas feature placeholder

## Modelo operativo actual

- `Expediciones` es la unidad principal de trabajo.
- Cada expedición agrupa dos patas operativas:
  - `recogida`
  - `entrega`
- `Shipments` y `Pickups` siguen existiendo como servicios/legs técnicas del circuito, pero la navegación principal de backoffice debe entrar por `Expediciones`.
- `Routes` soporta carga masiva por expedición completa mediante `expedition_ids`, dejando `shipment_ids` y `pickup_ids` solo para ajustes avanzados o excepcionales.

## Credenciales seed (local)

- Email: `admin@eco.local`
- Password: `password123`

## Smoke Test API

Con el servidor levantado (`php artisan serve`):

`./scripts/smoke_auth_users_roles.sh`

## Checklist CI sugerido

- Tests: `./vendor/bin/phpunit`

## Desarrollo local estilo Laravel 12

- `composer run dev`
  - levanta `php artisan serve`
  - levanta `php artisan queue:listen --tries=1`
  - levanta `php artisan pail --timeout=0`
  - levanta `npm run dev`

- `composer run dev:lan`
  - detecta automáticamente la IP LAN activa del Mac
  - exporta `APP_URL` y `SANCTUM_STATEFUL_DOMAINS` con esa IP
  - busca automáticamente puerto libre para Laravel a partir de `8000`
  - busca automáticamente puerto libre para Vite/HMR a partir de `5173`
  - expone Vite/HMR usando esa IP
  - pensado para pruebas web/PWA desde móvil en red local

Notas:

- si `8000` está ocupado, `php artisan serve` usará el siguiente puerto libre
- para pruebas móviles usa `composer run dev:lan`
- puedes forzar la IP con `LAN_IP_OVERRIDE=... composer run dev:lan`

## Despliegue a /httpdocs

El repositorio es código fuente Laravel. No es correcto subir solo `public/` ni tratar Git como si ya fuera el árbol final de `/httpdocs`, porque Laravel necesita también `app/`, `bootstrap/`, `config/`, `routes/`, `vendor/` y `storage/`.

Para shared hosting con `/httpdocs` como raíz, genera primero un release listo para subir:

```bash
cd /Users/joaquinarevalobueno/Developer/Eco\ Delivery\ Routes/apps/backend
composer install --no-dev --optimize-autoloader
npm run build
./scripts/build_httpdocs_release.sh
```

Salida:

- release listo en [apps/backend/.dist/httpdocs](/Users/joaquinarevalobueno/Developer/Eco%20Delivery%20Routes/apps/backend/.dist/httpdocs)

Ese directorio:

- mueve el contenido de `public/` a raíz para `/httpdocs`
- reescribe `index.php` para funcionar desde esa raíz
- excluye runtime y basura de desarrollo
- deja creados los directorios mínimos de `storage/` y `bootstrap/cache/`
- incluye un helper opcional de post-deploy:
  - [apps/backend/scripts/post_deploy_httpdocs.sh](/Users/joaquinarevalobueno/Developer/Eco%20Delivery%20Routes/apps/backend/scripts/post_deploy_httpdocs.sh)

Si quieres desplegar por `git pull` en el hosting usando una rama que contenga solo el árbol final de `/httpdocs`, publica una rama de release generada:

```bash
cd /Users/joaquinarevalobueno/Developer/Eco\ Delivery\ Routes/apps/backend
./scripts/publish_httpdocs_branch.sh
```

Por defecto publica en:

- `codex/httpdocs-release`

Esa rama sí contiene solo el contenido desplegable de `/httpdocs`.

Además, el repositorio ya incluye workflow de GitHub Actions para mantener esa rama al día automáticamente en cada push a `main`:

- [publish-httpdocs-release.yml](/Users/joaquinarevalobueno/Developer/Eco%20Delivery%20Routes/.github/workflows/publish-httpdocs-release.yml)

Flujo recomendado:

1. desarrollo normal sobre `main`
2. push a GitHub
3. GitHub publica `codex/httpdocs-release`
4. producción hace `git pull` sobre esa rama en `/httpdocs`

Post-deploy recomendado en producción:

```bash
cd /httpdocs
./.post-deploy.sh
```

Si en ese deploy quieres ejecutar migraciones:

```bash
cd /httpdocs
RUN_MIGRATIONS=1 ./.post-deploy.sh
```

Health check:

- Laravel expone `GET /up`
- úsalo para verificar que el despliegue quedó operativo tras el `git pull`

Archivos runtime que no deben versionarse:

- `bootstrap/cache/*.php`
- `storage/logs/*`
- `database/*.sqlite`
- `.env*`
- `node_modules/`
- `vendor/`
