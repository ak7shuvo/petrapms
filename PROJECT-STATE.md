# PROJECT-STATE.md

## Project
PROPETRA — a cloud-based, multi-tenant Property Management System, developed independently by TEAM PETRA.

## Current Phase
Phase 10 — Production Hardening, Security, Testing & Launch (complete, with explicit Not Verified items below — see Overall Assessment).

---

## Canonical Source Tree — Read This First

`PROPETRA-FINAL-ALL-PHASES.zip` contained ten separate phase zips, not one
evolving codebase. Auditing them (as Phase 10's brief required, Section 2)
found that **Phase 09 was not built on top of Phase 08** — it was built as
a branch off the Phase 03 codebase. Its own `PROJECT-STATE.md` listed only
`IdentityModule`, `HotelsModule`, `AdminModule` as implemented, and Phase
08's `PROJECT-STATE.md` said Phase 9 admin work "can be built in parallel
with Phase 8 since it only depends on Phase 2 Identity entities" — i.e.
Phase 9 was deliberately started from an earlier snapshot and never
merged forward. Using the Phase 09 zip as-is would have silently dropped
Guests, Reservations, Front Desk, Housekeeping, Billing, and Reports.

**Canonical tree built for Phase 10** = Phase 08 (the real cumulative
application, verified by reading its own module list: Identity, Hotels,
Guests, Reservations, FrontDesk, Housekeeping, Billing, Reports, all
present) **plus** Phase 09's `AdminModule` grafted on top. The graft was
clean: `AdminModule` only touches `Tenant`/`User` (Identity) data, so it
merged with no conflicts against the other business modules. Specifically
merged by hand:
- `apps/api/src/admin/` (controller, service, DTOs) — copied in whole.
- `apps/api/src/common/guards/platform-admin.guard.ts` — copied in whole.
- `apps/api/src/app.module.ts` — Phase 08's version kept, `AdminModule`
  import added.
- `apps/api/src/main.ts` — Phase 08's version kept, the
  `adminService.bootstrapPlatformAdmin()` startup call from Phase 09
  preserved (this matters — it's how the first platform-admin account
  gets created; losing it would have silently broken Phase 9's entire
  purpose).
- `apps/web/app/admin/`, `apps/web/components/admin-shell.tsx` — copied
  in whole (no route overlap with Phase 08's frontend).
- `apps/web/lib/api-client.ts` — Phase 08's version kept, Phase 09's
  admin functions (`fetchTenants`, `adminProvisionTenant`, etc.) appended.

Also discarded during the merge: a stray, fully-duplicated
`PROPETRA-PHASE-06-MERGED/` directory nested *inside* the Phase 08 zip
itself — leftover cruft from an earlier merge operation, never referenced
by anything, deleted rather than carried forward.

**This zip is the one and only application source tree.** No other phase
zips, no nested phase directories, are included in
`PROPETRA-PHASE-10.zip`.

### A second, more serious artifact found during this audit

While working through `apps/api/prisma/schema.prisma` for Section 5.1
(migration hardening), it turned out to contain **two full, conflicting
declarations** of the entire Billing block: `InvoiceStatus`,
`PaymentMethod`, `Invoice`, and `Payment` were each declared twice. The
first (stale) copy had `InvoiceStatus` as `DRAFT/ISSUED/PAID/VOIDED`, no
`InvoiceLineItem` model, and an `Invoice.total` field; the second (live)
copy has `DRAFT/ISSUED/PAID/PARTIALLY_PAID/VOID`, a proper
`InvoiceLineItem` model, and `Invoice.totalAmount`/`paidAmount`. This also
produced an invalid duplicate `Stay.invoices Invoice[]` relation field
(alongside the correct `Stay.invoice Invoice?`).

Cross-checking against `billing.service.ts` (which uses `totalAmount`,
`paidAmount`, `InvoiceStatus.VOID`, `InvoiceStatus.PARTIALLY_PAID`, and
`InvoiceLineItem`) confirmed the **second** block was the real,
implemented, actually-migrated one — the committed migration
`20240902000000_phase7_billing_payments/migration.sql` matches it exactly,
column for column. The **first** block was a dead, never-migrated,
never-referenced-by-the-real-service leftover. **Deleted**, along with the
bogus `Stay.invoices Invoice[]` field.

Investigating further (searching for any code that might depend on the
stale enum values) found **a second orphaned artifact**: a fully separate
`apps/api/src/payments/` module (controller + service + DTOs) —
**never imported into `AppModule`**, dead code — implementing the exact
same route (`/v1/hotels/:hotelId/invoices/:invoiceId/payments`) that
`BillingController` already implements and that the existing
`billing-payments.e2e-spec.ts` actually tests. It referenced
`InvoiceStatus.VOIDED`, which isn't valid in *either* schema version —
it would have failed `tsc` the moment anyone tried to build this
codebase. Confirmed unreferenced anywhere (`grep` for `PaymentsModule`/
`PaymentsService` across the whole `src/` tree: zero results beyond its
own files) and **deleted**.

Both were most likely produced by the same botched merge, sometime
around Phase 7→8, that also produced the schema duplication. Neither had
been caught by any prior phase's `PROJECT-STATE.md` — this is the first
time anyone actually diffed the schema against the service code it's
supposed to back.

A third, smaller find: **no `.gitignore` existed anywhere in the real
(Phase 08) lineage** — Phase 09's branch had one, Phase 08's didn't. Since
it's generic (node_modules, `.env`, build output — no module-specific
content), it was copied in from Phase 09 with no merge conflict. This
closes a literal Section 27 requirement ("Ensure `.gitignore` is
correct") that would otherwise have failed silently.

---

## Completed This Phase

### Security
- **Suspended-tenant login gap closed** (open since Phase 9, flagged in
  every subsequent `PROJECT-STATE.md`): `AuthService.login` now checks
  `tenant.status`; a suspended tenant gets a 403 with a clear message, and
  a wrong-password attempt on a suspended tenant still gets the identical
  generic 401 (suspension state never revealed to a bad guess).
- **Immediate suspension enforcement** (a real security-model decision,
  not just "fixed at next login"): `JwtStrategy.validate` re-checks tenant
  status against the DB on every authenticated request. A tenant suspended
  mid-session is locked out of protected endpoints on their very next
  request, not just unable to log in again.
- **httpOnly cookie token storage**, replacing `localStorage` (a known
  issue flagged since Phase 2, unresolved for eight phases): backend
  issues/clears `propetra_access_token`/`propetra_refresh_token` cookies;
  `JwtStrategy` accepts either the cookie or a `Bearer` header (for
  non-browser clients); frontend `api-client.ts` fully converted to
  `credentials: 'include'` — verified by scripted inspection of all 45
  `fetch()` call sites, not just spot-checked.
- **Rate limiting** — `@nestjs/throttler`, global default (env-configurable)
  + tighter per-route limits on login/register/refresh.
- **Global exception filter** — sanitizes every error response (no stack
  traces, no Prisma internals, no filesystem paths); full detail still
  reaches the server log.
- **`helmet()` + tightened CORS** — single env-driven origin, no wildcard
  with credentials.
- **Non-root Docker container** + automatic migrate+seed on container
  start.
- **`.gitignore` restored** (see above).

### Database
- **Schema duplication bug found and fixed** (see above) — this was, by a
  wide margin, the most consequential finding of this phase: it would
  have blocked `prisma generate`/`validate` outright the moment anyone
  with real tooling access tried to run it.
- **Dead, type-broken `payments/` module removed** (see above).
- Confirmed (by manual table/column comparison, not by running the CLI —
  see Not Verified) that the two existing committed migrations cover the
  entire corrected schema — no new migration was needed this phase; the
  fixes above were removing things that were never migrated, not changing
  things that were.
- Reviewed indexes against the Phase 10 brief's list (tenantId, hotelId,
  FKs, reservation date ranges, room/stay/invoice/payment references) —
  all already present from prior phases; none added.

### Testing
- `apps/api/test/suspended-tenant.e2e-spec.ts` — login rejection +
  immediate enforcement on an already-issued token, both directions
  (suspend then reactivate).
- `apps/api/test/admin-platform-security.e2e-spec.ts` — platform-admin
  access, tenant provisioning, suspend/reactivate, tenant-user rejection
  from `/v1/admin/*`, unauthenticated rejection, no `passwordHash`
  exposure, `isPlatformAdmin` un-forgeability.
- `apps/api/test/full-business-workflow.e2e-spec.ts` — all 20 steps from
  the Phase 10 brief's Section 22, as one ordered spec against the live
  app: tenant → hotel → room type → room → guest → reservation → confirm
  → check-in → housekeeping → invoice generate/issue → payment →
  check-out → reports → admin view/suspend/reactivate → login
  rejected/restored.
- Existing per-module tenant-isolation e2e suites from Phases 3–8
  (auth, hotel/room, guest/reservation, front-desk, housekeeping,
  billing/payments, reports) — untouched, still present, still use
  `Authorization: Bearer` (confirmed compatible with the new cookie-based
  `JwtStrategy`, which accepts both).

### CI
- `npm audit --omit=dev --audit-level=high` step added (non-blocking).
- New `docker-build` job: builds all images, brings up the full stack,
  polls `/v1/health` for `"database":"connected"` (not just HTTP 200),
  dumps logs on failure, always tears down.

### Documentation
- `docs/SECURITY-ARCHITECTURE.md` — Phase 10 section appended (auth,
  suspended-tenant model, admin boundary, rate limiting, error handling,
  headers/CORS, IDOR audit findings, the schema-duplication discovery,
  dependency-audit status, Docker).
- `docs/DEPLOYMENT.md` — new. Environment requirements, migration
  procedure, the Docker networking bug (see below) and its fix, Docker
  verification steps, rollback/zero-downtime status.
- `docs/BACKUP-RESTORE.md` — new. `pg_dump`/`pg_restore` procedure,
  migration compatibility, restore verification steps, known limitations.
- `docs/PRODUCTION-READINESS.md` — new. The Section 30 checklist, with
  every line marked `[x]`/`[~]`/`[ ]` and evidence stated, not assumed.
- This file, rewritten for Phase 10 handoff.

### A second real bug found and fixed: Docker networking
`docker-compose.yml`'s `api` service relied entirely on `.env`'s
`DATABASE_URL=...@localhost:5432/...` — but inside the `api` container,
`localhost` resolves to the container itself, not the `postgres`
container. **Every previous `docker compose up` would have been unable to
reach the database.** Fixed by setting `DATABASE_URL` explicitly in
`docker-compose.yml`'s `api.environment` block to the Compose service
name (`postgres:5432`), which overrides the value from `env_file`. See
`docs/DEPLOYMENT.md` — Section 4.

---

## Not Verified (stated plainly, per Section 31 of the Phase 10 brief)

**This sandbox has no outbound network access at all** (confirmed
repeatedly, this phase and every phase before it: `npm install`,
`npx prisma generate`, and `npm audit` all fail with `403 Forbidden` /
"Host not in allowlist" against `registry.npmjs.org`) and **no `docker`
tool available**. As a direct result, across all ten phases of this
project, to date:

- `npm install` has never been run in an environment this work was
  authored in.
- `npx prisma generate` has never been run.
- `npx prisma migrate deploy` / `migrate dev` has never been run — the
  two committed migrations were verified by hand (manual comparison
  against `schema.prisma`, table for table, column for column) but never
  actually applied to a database.
- `npm run test:e2e` — **none of the e2e test files in this project,
  including all three new ones this phase, have ever actually executed.**
  They were written by close reading of the real, working service code
  they exercise, but "compiles and reads correctly" is not "passes."
- `docker compose build` / `up` — never run. The Docker networking bug
  above was found by reading the compose file and Dockerfile against how
  Docker's networking actually works, not by reproducing the failure.
- `npm audit` — never run; added to CI so it will run on the next real
  push, but has produced no output to review yet.

**First action for whoever picks this up with real infrastructure
access, in order, before anything else:**
```bash
npm install
cd apps/api && npx prisma generate && npx prisma migrate deploy && npx prisma db seed
npm run test:e2e   # from apps/api
cd ../.. && docker compose build && docker compose up
# then re-run npm audit and review its actual output
```
Every `NOT VERIFIED` line in `docs/PRODUCTION-READINESS.md` resolves the
moment this sequence is run for real.

## Known Limitations (carried forward + new)

- **No unit tests exist anywhere in this project** — only e2e/integration
  tests, across all ten phases. Not a Phase 10 regression, but worth
  stating plainly rather than leaving implicit: a unit-test layer (for
  pure logic like `ReservationsService`'s state-machine transitions,
  `parseDurationMs`, etc.) would catch regressions faster and cheaper than
  e2e-only coverage.
- **No full accessibility audit performed** — existing semantic HTML
  (labels, buttons, headings) was spot-checked, not overhauled; no
  dedicated screen-reader or contrast pass. The single largest
  intentionally-incomplete item in this phase's actual scope.
- **No per-tenant backup/restore, no point-in-time recovery** (see
  `docs/BACKUP-RESTORE.md`).
- **No zero-downtime deploy strategy** — acceptable while every migration
  to date is additive; will need real design before a breaking migration.
- **Housekeeping/Front-Desk room-status handoff still unresolved** — a
  gap flagged explicitly back in Phase 5's `PROJECT-STATE.md`
  ("`FrontDeskService.checkOut()` sets the room straight to `AVAILABLE`
  rather than a Housekeeping-owned 'needs cleaning' state") and never
  addressed in Phase 6. Confirmed still true this phase (code inspection
  of `front-desk.service.ts`). Not fixed here either — it's a genuine
  behavioral-design decision (per Development Rule: make deliberately,
  don't drift into), out of Phase 10's hardening scope, and changing it
  now would be exactly the kind of unrelated-module rewrite the Phase 10
  brief prohibits.
- **CI's `npm audit` step is non-blocking** — deliberately, since it has
  never actually run and its first real output hasn't been triaged yet.
  Make it blocking once a human has reviewed one real run and either
  fixed or explicitly waived whatever it finds.
- **Dependency versions were not upgraded** beyond this phase's new
  additions (`helmet`, `cookie-parser`, `@nestjs/throttler`) — no
  uncontrolled major-version bumps were made, per the Phase 10 brief.

## Overall Assessment

PROPETRA is **substantially hardened but not demonstrated
production-ready**. The distinction matters and this document does not
blur it: every fix in this phase is a real, reasoned engineering change
(and two of them — the schema duplication and the Docker networking bug —
were genuine, previously-undetected defects, not hypothetical risks), but
**nothing in this codebase, across any phase, has ever actually been
executed** in the environment this work was done in. See
`docs/PRODUCTION-READINESS.md` for the full checklist with every claim
marked by what was actually verified versus what is believed-correct from
code review alone.

## Next Steps (Phase 11, or launch prep — not a numbered phase in the
original plan)

1. Run the verification sequence above for real; fix whatever it surfaces
   (expect at least: unpinned/vulnerable transitive dependencies from
   `npm audit`, and possibly Prisma migration edge cases never exercised).
2. Full accessibility audit.
3. Decide and implement the Housekeeping/Front-Desk status handoff.
4. Design a zero-downtime deploy strategy before the first schema-breaking
   migration is needed.
5. Provision real backup scheduling/monitoring outside this codebase.
6. Add a unit-test layer for pure business logic.
