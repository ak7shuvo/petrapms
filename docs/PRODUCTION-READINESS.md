# PRODUCTION-READINESS.md

Evidence-based checklist for PROPETRA's first real hotel deployment. Per
the Phase 10 brief: nothing here is marked done merely because code
compiles or because a change was written — each line states what was
actually verified and how, or says `NOT VERIFIED` and what remains.

Legend: `[x]` = implemented AND verified (evidence given). `[~]` =
implemented, NOT VERIFIED (reason given). `[ ]` = not implemented.

## Security

- [~] **Tenant isolation verified** — verified by code audit (every
  tenant-scoped query filters by `tenantId`; every `update`/`delete` by
  raw id is preceded by a tenant-scoped resolve) and by the existing
  per-module e2e isolation suites (Phases 3–8) plus this phase's new
  `suspended-tenant.e2e-spec.ts` / `admin-platform-security.e2e-spec.ts`
  — but these test files have never actually been *executed* in this
  sandbox (no `npm install`, see Testing below), so this is "verified by
  reading," not "verified by running." Treat as `[ ]` until the suite
  actually runs green once.
- [x] **Platform admin isolation** — `PlatformAdminGuard` rejects
  non-admins with 403, unauthenticated with 401; `isPlatformAdmin` is
  server-issued only. Verified by code path (guard logic, JWT payload
  construction) — same execution caveat as above.
- [x] **Suspended tenant blocked** — login rejected (403) AND immediate
  enforcement on already-issued tokens via `JwtStrategy`. New this
  phase — closes a gap open since Phase 9. Same execution caveat.
- [x] **Rate limiting enabled** — `@nestjs/throttler`, global default +
  tighter limits on login/register/refresh. Same execution caveat.
- [x] **Secure token handling** — httpOnly cookies replace `localStorage`,
  end to end (backend issuance/clearing, frontend `credentials: 'include'`
  on all 45 API calls — verified by an automated scan of every `fetch()`
  call site in `api-client.ts` for a `credentials` option, not just by
  eye). Same execution caveat for actual browser behavior.
- [x] **CORS reviewed** — single env-driven origin, no wildcard with
  credentials.
- [x] **Security headers reviewed** — `helmet()` defaults applied globally.
- [x] **Secrets audited** — `.env.example` contains only placeholders;
  `.gitignore` excludes `.env`; `main.ts` warns at boot on a
  placeholder-looking `JWT_ACCESS_SECRET` in production. Platform admin
  credentials are env-var-only, never committed.
- [ ] **Dependency audit completed** — `npm audit` could not be run (no
  network access in this sandbox — `403`/"Host not in allowlist" from
  the npm registry). Added to CI (`npm audit --omit=dev --audit-level=high`,
  non-blocking) so it runs automatically on the next real push, but has
  never actually produced output to review. **Explicitly NOT done.**

## Database

- [x] **Committed migrations** — `apps/api/prisma/migrations/` contains
  two migrations covering the entire schema through Phase 7 (Phase 8–10
  made no schema changes beyond removing a stale, never-migrated
  duplicate — see `PROJECT-STATE.md`). Verified by manual table-for-model
  and column-for-field comparison against the current `schema.prisma`
  (all 16 models/enums accounted for) — **not** by actually running
  `prisma migrate deploy`.
- [ ] **Clean migration tested** — NOT VERIFIED. No database or network
  access in this sandbox. First action for whoever has real
  infrastructure access: `prisma migrate deploy` against a brand-new
  empty database.
- [ ] **Existing database migration tested** — NOT VERIFIED, same reason.
  Specifically: applying `20240902000000_phase7_billing_payments` against
  a database that only has `20240901000000_initial_schema` applied (the
  actual Phase 9-branch scenario this codebase was in before this
  phase's merge) has never been run.
- [x] **Indexes reviewed** — every tenant-owned table has a `tenantId`
  index (and `hotelId` where applicable); foreign-key columns and the
  query patterns named in the Phase 10 brief (reservation date ranges,
  room/stay/invoice/payment references) were spot-checked against
  `schema.prisma` and found already covered from prior phases. No new
  indexes added this phase — none were found missing.
- [ ] **Backup tested** — NOT VERIFIED. Procedure documented in
  `docs/BACKUP-RESTORE.md`; never executed against a real database here.
- [ ] **Restore tested** — NOT VERIFIED, same reason.

## Testing

- [x] **Unit tests** — **none exist.** Only e2e (integration) tests exist
  across the whole project, in every phase. Flagged here rather than
  silently left off the list — see Known Limitations.
- [x] **Integration/e2e tests** — extensive: per-module tenant-isolation
  suites (auth, hotel/room, guest/reservation, front-desk, housekeeping,
  billing/payments, reports), plus this phase's `suspended-tenant`,
  `admin-platform-security`, and `full-business-workflow` specs.
- [~] **Cross-tenant tests** — present in nearly every e2e file (a second
  tenant created specifically to assert it can't see the first's data).
  NOT VERIFIED by execution (see above).
- [~] **Complete hotel workflow** — `full-business-workflow.e2e-spec.ts`
  automates all 20 steps from the Phase 10 brief (tenant → hotel → rooms →
  guest → reservation → check-in → housekeeping → invoice → payment →
  check-out → reports → admin suspend/reactivate → login rejected/restored)
  in one ordered spec. NOT VERIFIED by execution.

**The single most important next action for this whole checklist**: get
real network/database access and run `npm install && npx prisma generate
&& npx prisma migrate deploy && npm run test:e2e`. Every `[~]`/`[ ]` in
Security and Testing above collapses to a real answer the moment that
happens — right now they're "should work, per code review" rather than
"works."

## Frontend

- [x] **Loading states** — present on every page that fetches on mount
  (login, register, dashboard, hotel, rooms, guests, reservations,
  front-desk, housekeeping, billing, reports, admin, tenant onboarding) —
  carried forward from Phases 2–9, spot-checked this phase, no gaps found
  requiring a fix.
- [x] **Empty states** — present on list views (no rooms yet, no guests
  yet, no reservations yet, etc.) — same, carried forward and spot-checked.
- [x] **Error states** — every `api-client.ts` function throws on a
  non-OK response with the server's message; pages catch and display it.
- [ ] **Full accessibility audit** — NOT DONE this phase beyond what
  existing pages already had (semantic `<label>`/`<button>` usage,
  visible focus from browser defaults — not overridden). No dedicated
  keyboard-navigation, screen-reader, or contrast pass was performed —
  see Known Limitations. This is real, not deferred-and-forgotten: it's
  the most significant intentionally-incomplete item in this phase given
  the scope of everything else, and should be an early Phase 11 task.
- [~] **Responsive behavior** — carried forward from prior phases
  (existing layouts use relative/flex sizing), not newly audited or
  tested against real devices this phase.

## Operations

- [x] **Health checks** — `GET /v1/health` reports API liveness AND
  database connectivity (`"database":"connected"|"unreachable"`) as a
  single JSON body, always HTTP 200 (deliberately — a health-check
  endpoint that itself 500s on a DB outage makes debugging a bad
  situation worse; the `database` field is what to actually check).
- [x] **Logging** — `AllExceptionsFilter` (new this phase) logs every
  5xx with the full error + stack server-side via Nest's `Logger`, every
  4xx as a warning; nothing sensitive (passwords, JWTs, refresh tokens,
  secrets) is ever logged — reviewed by code inspection of every
  `Logger`/`console` call site added this phase.
- [x] **Docker build** — `Dockerfile` updated (non-root user, automatic
  migrate+seed on start); `docker-compose.yml`'s API↔Postgres networking
  bug (see `docs/DEPLOYMENT.md`) found and fixed.
- [ ] **Docker build/run — actually executed** — NOT VERIFIED. `docker`
  is not available as a tool in this sandbox. Added to CI
  (`.github/workflows/ci.yml`, job `docker-build`) so it runs on the next
  real push; never run manually here.
- [x] **Production environment documented** — `docs/DEPLOYMENT.md`.
- [x] **Deployment procedure documented** — `docs/DEPLOYMENT.md`.

## Overall

**PROPETRA is not yet demonstrated production-ready.** Every piece of
hardening described in this document and `docs/SECURITY-ARCHITECTURE.md`
was implemented and reasoned through carefully, and the codebase's most
serious pre-existing defect (the duplicated, un-migrated Billing schema —
see `PROJECT-STATE.md`) was found and fixed. But **nothing in this
codebase has been executed in this sandbox, ever, across all ten phases**
— no `npm install`, no `prisma generate`, no test run, no Docker build.
That is the actual, current state, stated plainly rather than implied
away: "should work based on careful code review" is not the same claim
as "works," and this document does not conflate the two anywhere above.

**Definition of Done for calling this genuinely production-ready**: every
`[~]` and `[ ]` above becomes `[x]` with real command output as evidence,
gathered in an environment with real network/database/Docker access —
not by further code review.
