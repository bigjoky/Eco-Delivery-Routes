# Apple Apps Skeleton

Estructura inicial para apps nativas:

- `EcoDeliveryRoutesMac`: app macOS (power-user).
- `EcoDeliveryRoutesMobile`: app iOS/iPadOS.
- `EcoDeliveryRoutesTV`: app tvOS readonly.
- `SharedCore`: modelos, auth y cliente API compartido.

## Nota

Se incluye esqueleto SwiftUI con:
- navegación base por módulo (`Auth`, `Users`, `Roles`),
- sesión/token compartido en `SharedCore`,
- cliente API preparado para backend real o mock (si no hay `API_BASE_URL`).

## tvOS Monitor

`EcoDeliveryRoutesTV` soporta monitor en tiempo real con fallback mock:
- `API_BASE_URL`: base del backend (acepta `/api` o `/api/v1`).
- `API_TOKEN` (opcional): bearer token para endpoints protegidos.

Si no existe `API_BASE_URL` o falla la conexión, el dashboard usa datos mock.
