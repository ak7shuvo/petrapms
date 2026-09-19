# BACKUP-RESTORE.md

Operational procedure for backing up and restoring PROPETRA's PostgreSQL
database. All of it is standard `pg_dump`/`pg_restore` — no custom
tooling was built this phase, deliberately: introducing a bespoke backup
mechanism would be exactly the kind of unnecessary complexity Phase 10's
brief warns against, and Postgres's own tools are already reliable and
well-understood by any operator who'll be running this in production.

## Backup

```bash
# Against the docker-compose postgres service:
docker compose exec -T postgres pg_dump -U propetra -d propetra -F c -f /tmp/propetra.dump
docker compose cp postgres:/tmp/propetra.dump ./backups/propetra-$(date +%Y%m%d-%H%M%S).dump

# Against a managed/standalone instance:
pg_dump -h <host> -U <user> -d propetra -F c -f propetra-$(date +%Y%m%d-%H%M%S).dump
```

`-F c` (custom format) is used rather than plain SQL: it's compressed,
supports parallel restore, and lets `pg_restore` selectively restore
objects if ever needed — plain-text `.sql` dumps do not.

**What's in a backup**: all tenant data, across all tenants, in one file
— there is no per-tenant backup/restore in this phase (see Known
Limitations). Backups contain the same sensitive data as the live
database (guest PII, financial records) and must be encrypted at rest and
access-restricted identically to the production database itself (see
`docs/SECURITY-ARCHITECTURE.md` — Backup Security). This documentation
does not cover *where* to store backups (S3 + encryption, offsite
replication, retention policy) — that's an infrastructure/ops decision
outside this codebase's scope, and should be made explicitly rather than
defaulted.

**Recommended cadence**: nightly full backup at minimum, as a starting
point — with WAL archiving / point-in-time recovery as a future
improvement once launch traffic patterns are known (see Known
Limitations). Not implemented or scheduled by this phase — no CI/cron
job triggers a backup automatically. Document and provision that as an
infrastructure task alongside wherever the database itself is hosted.

## Restore

```bash
# Against the docker-compose postgres service (into an EMPTY database —
# see the "restoring into a live database" warning below):
docker compose cp ./backups/propetra-20260101-020000.dump postgres:/tmp/restore.dump
docker compose exec -T postgres pg_restore -U propetra -d propetra --clean --if-exists /tmp/restore.dump

# Against a managed/standalone instance:
pg_restore -h <host> -U <user> -d propetra --clean --if-exists propetra-20260101-020000.dump
```

`--clean --if-exists` drops existing objects before recreating them, so
this is safe to run against a database that already has (stale/wrong)
schema in it — but it is **destructive** to whatever's currently there.
Never run this against the live production database except as an actual
disaster-recovery action.

## Migration Compatibility

A backup is only restorable cleanly into a database at the **same or a
later** migration state as when the backup was taken — restoring an old
backup and then running `prisma migrate deploy` forward is the supported
path; restoring into a database that's already ahead of the backup's
schema is not (and `pg_restore --clean` would likely fail partway through
on schema conflicts). Procedure:

1. `pg_restore` the dump into a clean/empty database.
2. `cd apps/api && npx prisma migrate deploy` to bring it up to the
   current schema.
3. Verify with `npx prisma migrate status` (should report "up to date").

## Restore Verification

After any restore (test or real), verify before trusting it:

```bash
# Row counts on a few key tables — sanity check nothing came back empty
docker compose exec -T postgres psql -U propetra -d propetra -c \
  "SELECT (SELECT count(*) FROM tenants) AS tenants, (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM reservations) AS reservations, (SELECT count(*) FROM invoices) AS invoices;"

# The application itself comes up and a known tenant can log in
curl http://localhost:3001/v1/health   # expect "database":"connected"
```

This two-step check (raw row counts, then an actual login through the
application) is the reproducible verification the team should run after
every restore — whether a drill or a real incident — before declaring
the restore successful.

## NOT VERIFIED

This entire procedure is standard `pg_dump`/`pg_restore` usage and has
**not been executed against a live PROPETRA database in this sandbox**
(no Postgres instance or network access available here — see
`PROJECT-STATE.md`). Run a full backup → restore → verification drill
for real, in a non-production environment, before relying on this
procedure during an actual incident.

## Known Limitations

- No per-tenant backup/restore — a restore is all-tenants-or-nothing.
  For a true accidental-deletion-by-one-tenant recovery, the current
  answer is restore the whole database to a point-in-time environment and
  extract that tenant's rows manually — acceptable for launch, not for
  scale.
- No point-in-time recovery (WAL archiving) — only whatever the backup
  cadence provides (see above).
- No automated backup scheduling or monitoring/alerting on backup
  failure — both are infrastructure decisions for wherever this gets
  deployed, not implemented in this codebase.
