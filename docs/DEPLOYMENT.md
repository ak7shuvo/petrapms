# DEPLOYMENT.md

Production deployment procedure for PROPETRA. Written from Phase 10
(Production Hardening) — see `PROJECT-STATE.md` for what has and hasn't
actually been verified in an environment with real network access.

## 1. Environment Requirements

- Node.js 20+
- PostgreSQL 16 (a managed instance in production; `docker-compose.yml`'s
  `postgres` service for local development/single-box deployments)
- HTTPS terminating in front of both the API and the web app —
  **required**, not optional: the auth cookies use `Secure` +
  `SameSite=None` in production (`NODE_ENV=production`), which browsers
  refuse to send at all over plain HTTP.
- Required environment variables — see `.env.example` for the full list.
  The ones that matter most for production specifically:
  - `JWT_ACCESS_SECRET` — a real random value (`openssl rand -hex 32`),
    **never** the development placeholder. `main.ts` logs a warning at
    boot if this looks like a placeholder in a production environment.
  - `DATABASE_URL` — must point at the real Postgres instance; inside
    Docker Compose this is overridden to the `postgres` service hostname
    regardless of what's in `.env` (see Section 4 below — this was a
    real bug found and fixed in Phase 10).
  - `WEB_ORIGIN` — the exact origin the web app is served from (no
    wildcard; CORS is single-origin + credentials).
  - `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` — set once to
    bootstrap the first TEAM PETRA platform-admin account (idempotent —
    safe to leave set across restarts; the API only acts on it if no
    platform admin with that email exists yet, or promotes an existing
    account of that email that isn't yet marked as one).

## 2. Database Migrations

**Never use `prisma db push` in production.** Committed migrations live
in `apps/api/prisma/migrations/` (`20240901000000_initial_schema`,
`20240902000000_phase7_billing_payments`) and cover the entire schema as
of Phase 10 — no schema changes were made in Phases 8–10 beyond fixing a
duplicated Billing block that was never actually migrated (see
`PROJECT-STATE.md` — Canonical Source Tree).

Deploy procedure:

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed   # idempotent — safe to re-run every deploy
```

`npx prisma migrate deploy` applies any migration not yet recorded in the
target database's `_prisma_migrations` table and does not generate new
migrations or prompt for anything — safe for CI/CD. The API container's
`Dockerfile` runs both of these automatically on every start.

**NOT VERIFIED**: actually running `prisma migrate deploy` against a real
Postgres instance, in either a clean or an already-Phase-9-shaped
database, has not been done in this sandbox (no network access to even
fetch the `prisma` CLI — see `PROJECT-STATE.md`). The migration SQL was
reviewed by hand against the current `schema.prisma` (table-for-model and
column-for-field correspondence checked manually) but that is not a
substitute for actually running it. **Do this for real before the first
production deploy.**

## 3. Application Deploy Steps

```bash
npm ci
cd apps/api && npx prisma generate && cd ../..
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..
npm run build --workspace=apps/api
npm run build --workspace=apps/web
# Start both apps (start:prod for the API, `next start` for the web app)
# behind your HTTPS-terminating reverse proxy / load balancer.
```

## 4. Docker Networking — Known Bug, Fixed in Phase 10

`.env.example`'s `DATABASE_URL` uses `localhost:5432`, which is correct
for running the API directly on your machine against the Compose
`postgres` service's published port — but **inside** the `api` container,
`localhost` resolves to the container itself, not the `postgres`
container. Every previous `docker compose up` was silently unable to
reach the database as a result. `docker-compose.yml`'s `api` service now
sets `DATABASE_URL` explicitly to `postgres:5432` (the Compose service
name) in its `environment:` block, which takes precedence over the value
in `env_file: .env` (Compose applies `environment` after `env_file`). If
you fork this compose file for another orchestrator (Kubernetes, ECS,
etc.), replicate this: the database hostname must be the service's
network name, never `localhost`.

## 5. Docker Verification

```bash
cp .env.example .env   # then edit JWT_ACCESS_SECRET etc. for anything beyond local testing
docker compose build
docker compose up
```

Then verify:
- `curl http://localhost:3001/v1/health` returns
  `{"status":"ok","database":"connected",...}` — `"connected"`
  specifically, not just a 200 (the endpoint returns 200 either way; only
  the `database` field tells you migrations actually ran and the DB is
  reachable).
- `http://localhost:3000` loads and redirects to `/login`.
- Registering a tenant and logging in works end-to-end through the
  browser (exercises CORS + the httpOnly cookie flow together, which is
  the part most likely to break in a new environment).

CI (`.github/workflows/ci.yml`, job `docker-build`) now runs this
sequence — build, up, poll `/v1/health` for a connected database, tear
down — on every push, using the entrypoint's own automatic
migrate+seed rather than a separate CI step.

**NOT VERIFIED**: this CI job and the manual steps above have not been
executed in this sandbox (`docker` is not available in this container's
tool environment). Run them for real — ideally by simply letting the new
CI job run on the next push — before relying on this Docker setup for a
real deployment.

## 6. Rollback

There is no automated rollback tooling yet (Known Limitation — see
`PROJECT-STATE.md`). For now: `prisma migrate deploy` is forward-only;
rolling back a bad migration means writing and committing a new
migration that reverses it, or restoring from backup (see
`docs/BACKUP-RESTORE.md`) and redeploying the previous application
version. Do not manually edit rows in `_prisma_migrations`.

## 7. Zero-Downtime Deploys

Not yet designed (Known Limitation). The current procedure assumes a
brief restart window; there is no blue/green or rolling-deploy setup, and
no migration has yet needed backward-compatibility handling (all
migrations to date are additive). This should be designed explicitly
before a migration that renames or drops a column is needed, not
discovered under pressure at that point.
