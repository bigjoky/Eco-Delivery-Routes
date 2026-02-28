# ADR 0013: Auth Refresh Multicliente + Auditoria de Usuario

## Estado
Aprobado - 2026-02-28

## Contexto
Se necesitaba cerrar el flujo de login y usuarios con:
- expiracion/refresh de sesion en web, Android e Apple (iOS/macOS),
- detalle de usuario con timeline auditado,
- trazabilidad de cambios de usuario (create/update/assign roles).

## Decision
- Estandarizar contrato `/api/v1/auth/refresh` para renovacion de token en clientes.
- Aplicar reintento automatico en `401`:
  - web: `authorizedFetch` + refresco de token + invalidacion de sesion si falla.
  - Android: `executeWithRefresh` en GET/POST autenticados.
  - Apple SharedCore: `execute` con refresh y reintento transparente.
- Extender auditoria backend:
  - eventos `user.created`, `user.updated`, `user.roles.assigned`.
  - filtro `resource=user` en `/api/v1/audit-logs`.
- Añadir pantalla web `UserDetailPage` con datos del usuario + timeline.

## Consecuencias
- Sesion consistente y recuperable entre plataformas sin re-login inmediato en primer `401`.
- Mayor observabilidad de cambios de RBAC/estado en usuarios.
- Contrato OpenAPI actualizado para recurso de auditoria `user`.

## Implementacion asociada
- Backend:
  - `app/Http/Controllers/Api/V1/UserController.php`
  - `app/Http/Controllers/Api/V1/AuditLogController.php`
  - `app/Models/User.php`
  - `tests/Feature/Api/V1/UserMutationsHttpTest.php`
  - `openapi.yaml`
- Web:
  - `src/services/apiClient.ts`
  - `src/features/users/UserDetailPage.tsx`
  - `src/features/users/UsersPage.tsx`
- Android:
  - `core/network/ApiClient.kt`
  - `core/session/SessionStore.kt`
  - `navigation/AppNavHost.kt`
- Apple:
  - `SharedCore/API/APIClient.swift`
  - `EcoDeliveryRoutesMobile/ContentView.swift`
  - `EcoDeliveryRoutesMac/ContentView.swift`
