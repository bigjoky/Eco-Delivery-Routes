# ADR 0015: User lifecycle actions and cross-client users read

- Date: 2026-02-28
- Status: Accepted

## Context
After stabilizing RBAC role-permission audit, user management still lacked explicit lifecycle operations and consistent client support:

- No dedicated endpoints for suspend/reactivate/reset-password flows.
- Web UI required direct operational actions for user lifecycle.
- macOS needed real `/users` API consumption to continue login/users rollout beyond mock-only screens.
- Role-permission API needed stronger validation coverage.

## Decision
- Add user lifecycle endpoints in `/api/v1`:
  - `POST /users/{id}/suspend` (`users.suspend`)
  - `POST /users/{id}/reactivate` (`users.suspend`)
  - `POST /users/{id}/reset-password` (`users.update`)
- Enforce guard: self-suspend is blocked (`USER_SELF_SUSPEND_NOT_ALLOWED`).
- On password reset, revoke all Sanctum tokens for target user.
- Emit audit events:
  - `user.suspended`
  - `user.reactivated`
  - `user.password.reset`
- Extend Web user screens (list/detail) with suspend/reactivate/reset-password actions.
- Extend SharedCore/APIClient + macOS app with paginated users read from real API.
- Add integration tests for new user lifecycle endpoints and role-permission validation/not-found cases.

## Consequences
- User lifecycle actions are explicit, auditable, and permission-scoped.
- Operational user actions are available in web and visible in audit timeline.
- macOS moves forward on real API users integration, reducing mock-only dependency.
- Security posture improves by revoking stale user tokens on admin password reset.
