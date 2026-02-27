# Structure Map (Cross-Platform)

## Modules

- `auth`: inicio/cierre/refresh sesión + perfil actual.
- `users`: listado, detalle, creación y edición básica.
- `roles`: listado de roles y asignación a usuarios.

## Layers by platform

- Backend (Laravel): `Domain` + `Application` + `Infrastructure` + `Http`.
- Web (React): `core` + `features` + `shared`.
- Apple (SwiftUI): `SharedCore` + shell por target (iOS/macOS/tvOS).
- Android (Compose): `core` + `features` + `navigation`.

## Contract alignment

- Endpoint base: `/api/v1`.
- DTOs compartidos: `UserSummary`, `RoleSummary`, `AuthToken`.
- Errores base: `AUTH_INVALID_CREDENTIALS`, `AUTH_UNAUTHORIZED`, `VALIDATION_ERROR`.
