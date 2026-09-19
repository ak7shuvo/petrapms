# PROPETRA — Infrastructure Strategy

> **Status: Proposed direction.** No specific cloud provider is chosen; none should be assumed.

## Development Environment

- Docker-based local development so that every contributor (human or AI) runs the same environment: application, database, and supporting services defined via `docker-compose`.
- Environment configuration via `.env` files locally, never committed; `.env.example` documents required variables (see `AI-HANDOFF-GUIDE.md`).

## Application Hosting

- The NestJS backend and Next.js frontend are containerized (Docker) for portability across hosting environments.
- Specific hosting provider is not yet decided; the architecture should not assume provider-specific features unless a decision is made and documented.

## PostgreSQL Hosting

- A managed or self-hosted PostgreSQL instance, provider to be decided. Requirements: reliable backups, encryption at rest, and network-level access restriction to the application layer only.

## Object / File Storage

- Provider not yet decided. Needed for artifacts such as exported reports or guest-related documents once those features are implemented.

## Reverse Proxy & HTTPS

- All production traffic is expected to be served over HTTPS via a reverse proxy (specific software, e.g., Nginx, to be decided at implementation time).

## Environment Variables

- All configuration that differs between environments (database URL, secrets, feature flags) is provided via environment variables, never hardcoded.

## CI/CD

- An automated pipeline runs builds, tests, and (eventually) deployments on code changes. Specific platform not yet decided.

## Database Migrations

- All schema changes go through Prisma migrations, applied consistently across environments — no manual production schema edits (see `DEVELOPMENT-RULES.md`).

## Backup

- Regular, automated, encrypted backups of the production database are a baseline requirement before real hotel data is handled. Restore procedures should be tested, not just assumed to work.

## Monitoring & Logging

- Centralized logging and basic uptime/health monitoring are expected once the system is live; specific tooling to be decided (candidate categories: application performance monitoring, log aggregation, uptime checks).

## Production vs. Staging

- At least two environments are expected: staging (for testing changes before release) and production (serving real hotel clients). Configuration and secrets are strictly separated between them.

## Explicitly Not Yet Decided

- Cloud provider (e.g., AWS, GCP, Azure, or a smaller managed-hosting provider).
- Specific CI/CD platform.
- Specific monitoring/logging stack.
- Object storage provider.
- Disaster recovery specifics beyond "backups exist and are tested."
