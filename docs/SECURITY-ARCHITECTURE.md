# PROPETRA — Security Architecture

> **Status: Proposed foundation.** No compliance certification (e.g., PCI-DSS, SOC 2) is claimed or assumed. This document defines direction, to be hardened progressively (see Phase 10 in `DEVELOPMENT-PHASES.md`).

## Security Principles

- Tenant isolation is treated as a security property, not just a data-modeling convenience (see `MULTI-TENANCY.md`).
- Least privilege: users and system components get only the access they need.
- Defense in depth: no single control is relied upon exclusively.
- Auditability: significant actions are traceable to a user, tenant, and time.

## Authentication

- User accounts are authenticated via credentials (mechanism — e.g., password-based with hashing — to be finalized at implementation time).
- Session or token-based authentication (exact approach, e.g., JWT vs. server-side sessions, to be decided in Phase 2).
- TEAM PETRA platform accounts are authenticated through the same underlying mechanism but are flagged as platform-level, not tenant-scoped.

## Authorization (RBAC)

- Access control is role-based, evaluated together with tenant context (see `USER-ROLES.md`).
- Every protected API operation checks both "does this user have the required permission" and "does this operation target the user's own tenant."

## Password / Credential Security

- Passwords, if used, must be stored using a strong, salted hashing algorithm — never in plain text or reversible encryption.
- Credential-related failures (e.g., login attempts) should be handled without revealing whether a username exists.

## Session / Token Security

- Tokens/sessions should have reasonable expiration and renewal handling.
- Sensitive operations may warrant re-authentication or additional checks (exact scope to be defined per module, e.g., for payment operations).

## API Security

- All tenant-data endpoints require authentication and tenant-scoped authorization.
- Input validation is enforced on every API boundary (see `API-ARCHITECTURE.md`).
- Rate limiting is applied to sensitive endpoints (e.g., authentication) to reduce abuse risk.

## Input Validation

- All external input (API requests, form submissions) is validated against explicit schemas before reaching business logic.
- Validation failures return clear, safe error responses without leaking internal details.

## Rate Limiting

- Applied at minimum to authentication endpoints; broader application-wide rate limiting is a candidate for later hardening (Phase 10).

## Audit Logging

- Significant actions (permission changes, financial transactions, reservation modifications, administrative actions) are recorded with actor, tenant, timestamp, and action detail.
- Audit logs are treated as tenant-scoped data for hotel-level actions and as platform-scoped data for TEAM PETRA administrative actions.

## Secrets Management

- No secrets (API keys, database credentials, tokens) are ever committed to source control.
- `.env.example` files document required variables without real values; actual secrets are provided via environment configuration at deploy time (see `INFRASTRUCTURE.md` and `AI-HANDOFF-GUIDE.md`).

## Database Security

- Database access is restricted to the application layer; no direct external access in production.
- Tenant scoping is enforced centrally in the data-access layer (see `MULTI-TENANCY.md`).
- Financial and identity-related operations use transactions to avoid partial/inconsistent writes.

## Backup Security

- Backups (see `INFRASTRUCTURE.md`) must be encrypted at rest and access-restricted, since they contain the same sensitive tenant data as the live system.

## Common Risk Awareness (OWASP-Style)

The following categories are treated as standing engineering concerns throughout development, not a one-time checklist: injection flaws, broken authentication/session management, broken access control (including cross-tenant access), sensitive data exposure, security misconfiguration, and insufficient logging/monitoring.

## Explicitly Not Yet Decided

- Specific authentication library/approach (to be selected in Phase 2).
- Specific secrets-management tooling (e.g., a dedicated secrets manager vs. environment variables) — direction only, provider not chosen.
- Formal compliance roadmap (if pursued, would be a deliberate future initiative, not assumed).

---

# Phase 10 — Production Hardening (Implemented)

This section documents what was actually implemented, superseding the
"Explicitly Not Yet Decided" placeholders above where they're now
resolved.

## Authentication & Token Storage

- **Password hashing**: bcrypt, cost factor 12 (`identity/auth.service.ts`).
- **JWTs**: short-lived access tokens (default 15m, `JWT_ACCESS_EXPIRES_IN`)
  signed with `JWT_ACCESS_SECRET`; opaque, SHA-256-hashed, DB-stored
  refresh tokens (default 7d, `JWT_REFRESH_EXPIRES_IN`), rotated on every
  use (the presented token is revoked and a new one issued), so a leaked
  refresh token is only usable once before rotation makes it stale.
- **Token transport**: httpOnly cookies (`propetra_access_token`,
  `propetra_refresh_token` — see `identity/cookie.constants.ts`), replacing
  the `localStorage` approach flagged as a known issue since Phase 2. The
  refresh cookie is scoped to `/v1/auth` only. `Secure` + `SameSite=None`
  in production (requires HTTPS — see `docs/DEPLOYMENT.md`); `SameSite=Lax`
  in development over plain HTTP. `JwtStrategy` also still accepts a
  `Authorization: Bearer` header, for non-browser API clients (the e2e
  suite included).
- **Credential enumeration**: login returns an identical generic 401
  ("Invalid email or password") for "no such user", "wrong password", and
  "account disabled" — verified by a dummy bcrypt comparison on the
  no-such-user path so response timing doesn't distinguish the cases
  either. A suspended tenant's correct-email-wrong-password attempt also
  returns the same generic 401, not a 403 — suspension state is only
  revealed once the password is actually correct.
- **Logout**: revokes the presented refresh token server-side and clears
  both cookies. Best-effort (doesn't fail if the token was already gone).

## Suspended Tenant Enforcement — Chosen Model

**Immediate enforcement**, not "blocked only at next login": see
`identity/jwt.strategy.ts`. Every authenticated request for a tenant
account re-checks that tenant's `status` against the database (a single
indexed lookup by primary key). A tenant suspended mid-session is locked
out of every protected endpoint on their very next request, not merely
unable to log in again. Trade-off accepted deliberately: one extra query
per authenticated request, in exchange for suspension being a real
security boundary rather than something a live JWT can outrun for up to
its full 15-minute lifetime. Verified in
`apps/api/test/suspended-tenant.e2e-spec.ts`.

## Platform Admin Boundary

Unchanged in mechanism from Phase 9, re-verified this phase:
`isPlatformAdmin` is set only from the `users` table row, embedded into
the server-signed JWT at login, and never accepted from any request body
or client-controlled input — there is no endpoint that writes it except
`AdminService.bootstrapPlatformAdmin()`, which only runs at process
startup from `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD` environment
variables (never committed — see `.env.example`). `PlatformAdminGuard`
rejects every non-platform-admin caller from `/v1/admin/*` with 403;
unauthenticated callers get 401 from `JwtAuthGuard` first. Verified in
`apps/api/test/admin-platform-security.e2e-spec.ts`, including an
explicit assertion that no admin response ever contains `passwordHash`.

## Rate Limiting

`@nestjs/throttler`, configured in `app.module.ts`:
- Global default: `THROTTLE_LIMIT` (default 120) requests per
  `THROTTLE_TTL_MS` (default 60000ms) per client, applied to every route
  via `APP_GUARD`.
- Tighter override on the actual brute-force/enumeration targets
  (`identity/auth.controller.ts`): `register-tenant` and `login` at 5/min,
  `refresh` at 10/min. `logout` is exempted (`@SkipThrottle()`) — it isn't
  a target and shouldn't be able to strand a user who's trying to sign out.
- Rationale for the numbers: 5/min on login is generous enough for a
  front-desk staff member who mistypes a password a couple of times, but
  makes a meaningful online brute-force attempt impractical. Tune via env
  vars per deployment rather than redeploying code.

## Error Handling

`common/filters/all-exceptions.filter.ts`, registered globally in
`main.ts`. Guarantees every error response is one of a small set of
shapes (`{ statusCode, message }`) — no stack traces, no Prisma internals
(a `PrismaClientKnownRequestError` is mapped to a generic 409/404/400
rather than echoed), no filesystem paths, no environment values. The
*original* error (full message + stack) is always still written to the
server log via Nest's `Logger`, so real debugging information isn't lost
— it's just never sent to the client.

## Security Headers & CORS

- `helmet()` applied globally in `main.ts` (X-Content-Type-Options,
  X-Frame-Options / CSP frame-ancestors, Referrer-Policy, etc. — helmet's
  defaults, not further customized this phase).
- CORS: single configured origin (`WEB_ORIGIN`, no wildcard) with
  `credentials: true` — a wildcard origin with credentials would let any
  site read cross-tenant/session data via a victim's browser, so this is
  treated as a hard rule, not a convenience default.
- HTTPS is assumed in production (required for the `Secure` cookie flag
  to function at all) — see `docs/DEPLOYMENT.md`.

## Input Validation

Unchanged in mechanism, re-verified this phase: global `ValidationPipe`
(`whitelist: true, forbidNonWhitelisted: true, transform: true`) in
`main.ts` rejects any request with unrecognized fields rather than
silently dropping them, and every DTO across every module already used
`class-validator` decorators (type, length, enum, numeric, date, UUID
constraints) — spot-checked across identity, hotels, guests, reservations,
front-desk, housekeeping, billing, admin DTOs; no gaps found requiring a
fix this phase.

## Multi-Tenancy / IDOR Audit

Every tenant-scoped `service.ts` file across billing, payments-via-billing,
reports, housekeeping, front-desk, guests, reservations, and hotels was
checked: every `findFirst`/`findMany`/`count` query filters by `tenantId`
(usually `hotelId` too), and every `update`/`delete` that addresses a row
by raw `id` alone is always preceded by a tenant-scoped `resolveX()` call
that would 404 first if the id belongs to another tenant — the pattern
established in Phase 2's `UsersService` and followed consistently since.
No missing-tenant-filter query was found. Existing per-module
tenant-isolation e2e suites (Phases 3–8) plus this phase's new
`suspended-tenant.e2e-spec.ts` and `admin-platform-security.e2e-spec.ts`
exercise this at the HTTP layer, not just by code review.

## Known Gap Found & Fixed This Phase: Duplicated Billing Schema

While auditing the schema (Section 5.1 of the Phase 10 brief),
`apps/api/prisma/schema.prisma` was found to contain **two separate,
conflicting declarations** of `InvoiceStatus`, `PaymentMethod`, `Invoice`,
and `Payment` — an orphaned earlier draft (never migrated, didn't match
`billing.service.ts` at all: wrong enum values, no `InvoiceLineItem`,
wrong field names) sitting alongside the real, migrated version. This
also produced an invalid duplicate `Stay.invoices Invoice[]` relation
field. A fully separate, **never-imported** `apps/api/src/payments/`
module (controller + service + DTOs) was also found, duplicating
`BillingController`'s payment endpoints at the identical route
(`/v1/hotels/:hotelId/invoices/:invoiceId/payments`) but written against
the stale schema (referencing `InvoiceStatus.VOIDED`, not a valid value
in either version) — dead code that would have failed `tsc`. Both were
removed; see `PROJECT-STATE.md` — Canonical Source Tree for the full
account of how this happened (a botched Billing merge, most likely
between Phase 7 and Phase 8).

## Dependency Security

`npm audit` / `npx prisma generate` were attempted again this phase and
are **NOT VERIFIED** — this sandbox has no outbound network access at
all (confirmed via repeated `403 Forbidden` / "Host not in allowlist"
errors from `registry.npmjs.org`), the same constraint noted in every
prior phase's `PROJECT-STATE.md`. CI (`.github/workflows/ci.yml`) now
runs `npm audit --omit=dev --audit-level=high` on every push (non-blocking
this phase — see `PROJECT-STATE.md` — Not Verified — until a real run's
output can be reviewed and either fixed or explicitly waived). No
dependency versions were bumped beyond the new additions this phase
(`helmet`, `cookie-parser`, `@nestjs/throttler`) — no uncontrolled
major-version upgrades were performed.

## Docker

`apps/api/Dockerfile` now runs as a non-root user (`node`, uid 1000,
already provided by the `node:20-alpine` base image) rather than root,
and runs `prisma migrate deploy` + seed automatically on container start
so `docker compose up` alone produces a working stack — see
`docs/DEPLOYMENT.md`.
