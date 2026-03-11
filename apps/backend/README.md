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
