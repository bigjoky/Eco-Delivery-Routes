# ADR 0014: Roles permissions audit and cross-client auth hardening

- Date: 2026-02-28
- Status: Accepted

## Context
The platform already supports RBAC and quality/settlement workflows, but we needed three concrete gaps closed for implementation readiness:

1. Role detail and permission assignment needed explicit API/UI support with full audit trace.
2. Auth behavior needed parity and regression coverage across Web (mock mode), Android (token refresh path), and tvOS (read-only monitor with expiring token).
3. Staging environment for Malaga operations required deterministic seed data to start UAT quickly.

## Decision
- Add `/api/v1/roles/{id}` and `/api/v1/roles/{id}/permissions` with `roles.read` and `roles.assign` enforcement.
- Emit `role.permissions.assigned` audit event including before/after/added/removed permission IDs.
- Extend audit filters to support `resource=role` and update OpenAPI as source of truth.
- Add web role-detail screen to inspect role permissions and execute controlled assignments.
- Harden auth flow behavior:
  - Web mock login now persists token and resolves roles via `/auth/me` equivalent.
  - Android auth-flow test validates 401 -> refresh -> retry -> logout with refreshed token.
  - tvOS monitor service now auto-resolves token, refreshes on 401, and retries read requests.
- Add `MalagaStagingSeeder` and wire it to `DatabaseSeeder` for `staging` env.

## Consequences
- Permissions administration is now auditable end-to-end.
- Client auth reliability is improved and covered by automated tests.
- Staging bootstrap for Malaga hub is reproducible.
- Any future policy around role/permission changes can rely on immutable audit evidence.
