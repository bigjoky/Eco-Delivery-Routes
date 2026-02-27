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
