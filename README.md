# PROPETRA — Phase 10: Production Hardening, Security, Testing & Launch

A cloud-based, multi-tenant hotel Property Management System. This
package is the canonical, cumulative application through Phase 10 —
Identity/Auth, Hotel & Room Management, Guests, Reservations, Front Desk,
Housekeeping, Billing & Payments, Reports, TEAM PETRA Central
Administration, and this phase's production-hardening pass.

**Read `PROJECT-STATE.md` first.** It explains how this tree was
assembled (the input archive's Phase 9 was a branch off Phase 3, not
built on Phase 8 — see PROJECT-STATE.md for the full audit trail), two
real bugs found and fixed this phase (a duplicated Billing schema block,
and a Docker networking misconfiguration), and — importantly — that
nothing in this codebase has ever actually been executed in the sandbox
this work was authored in. See `docs/PRODUCTION-READINESS.md` for the
evidence-based checklist.

## Project Structure

```text
PROPETRA-PHASE-10/
├── apps/
│   ├── api/          NestJS backend (modular monolith)
│   │   ├── src/       identity, hotels, guests, reservations, front-desk,
│   │   │              housekeeping, billing, reports, admin, common
│   │   ├── prisma/     schema.prisma + committed migrations
│   │   └── test/       e2e suites (one per module + Phase 10 additions)
│   └── web/           Next.js frontend (dashboard + admin console)
├── docs/              Architecture, security, deployment, backup docs
├── .github/workflows/ CI (lint/build/e2e + new Docker verification job)
├── docker-compose.yml Local development / single-box deployment
├── .env.example       Required environment variables
├── PROJECT-STATE.md   Current project state — read this first
└── README.md          This file
```

## Running Locally

```bash
cp .env.example .env
# Edit .env: set a real random JWT_ACCESS_SECRET (openssl rand -hex 32),
# and optionally PLATFORM_ADMIN_EMAIL/PASSWORD to bootstrap an admin account.
docker compose up --build
```

- API: http://localhost:3001/v1/health — check the `database` field is
  `"connected"`, not just that you get HTTP 200.
- Web: http://localhost:3000 (redirects to `/login`)

### Manual setup (Node.js 20+, local PostgreSQL)

```bash
cp .env.example .env
npm install

cd apps/api
npx prisma generate
npx prisma migrate deploy   # real committed migrations — see docs/DEPLOYMENT.md
npx prisma db seed
npm run start:dev

# in another terminal
cd apps/web
npm run dev
```

**None of the above has been executed in the environment this codebase
was authored in** — see `PROJECT-STATE.md` — Not Verified. Please run it
for real and report back what breaks.

## Verifying the Full Workflow

`apps/api/test/full-business-workflow.e2e-spec.ts` automates the entire
real-hotel lifecycle end to end: tenant creation, hotel/room setup, guest,
reservation, check-in, housekeeping, invoicing, payment, check-out,
reports, and platform-admin tenant suspend/reactivate. Run it with:

```bash
cd apps/api
npm run test:e2e
```

## Documentation

- `docs/AI-HANDOFF-GUIDE.md` — recommended reading order for continuing
  this project.
- `docs/SECURITY-ARCHITECTURE.md` — what's implemented and why, including
  this phase's Production Hardening section.
- `docs/DEPLOYMENT.md` — environment requirements, migration/deploy
  procedure, the Docker networking fix.
- `docs/BACKUP-RESTORE.md` — backup/restore procedure.
- `docs/PRODUCTION-READINESS.md` — the evidence-based checklist; start
  here to see exactly what's verified versus not.

## What's Intentionally Not Here Yet

See `PROJECT-STATE.md` — Known Limitations for the full list: no unit
test layer (e2e only), no full accessibility audit, no per-tenant
backup/restore, no zero-downtime deploy strategy, and the
Housekeeping/Front-Desk room-status handoff decision flagged back in
Phase 5 and still unresolved.

## Next Step

Run the real verification sequence (`npm install` →
`prisma generate/migrate deploy` → `npm run test:e2e` → `docker compose
up`) in an environment with actual network/database/Docker access — this
is the single highest-priority next action, ahead of any new feature
work. See `PROJECT-STATE.md` — Not Verified for the exact commands.
