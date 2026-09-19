# PROPETRA — Technology Stack

> **Status: Proposed.** Nothing below is confirmed as installed, configured, or implemented until explicitly stated in `PROJECT-STATE.md`. This document defines the initial technical direction only.

## Frontend

| Area | Choice | Notes |
|---|---|---|
| Language | TypeScript | Type safety across the frontend |
| Framework | React | Component-based UI |
| Meta-framework | Next.js | Routing, rendering strategy, and application structure |

## Backend

| Area | Choice | Notes |
|---|---|---|
| Language | TypeScript | Shared language with frontend reduces context-switching |
| Framework | NestJS | Structured, modular backend framework well suited to a modular monolith |

## Database

| Area | Choice | Notes |
|---|---|---|
| Database engine | PostgreSQL | Relational database, strong transactional guarantees |
| ORM | Prisma | Type-safe database access and migrations |

## Infrastructure

| Area | Choice | Notes |
|---|---|---|
| OS | Linux | Standard server environment |
| Containerization | Docker | Consistent environments across development and deployment |
| CI/CD | To be defined per pipeline provider | Automated build, test, and deployment |

## Optional / Future Technology

- **Python** — proposed for future analytics, AI, or data-processing workloads. Not part of the initial core system. Would run alongside the TypeScript stack rather than replace it, likely as a separate service invoked when such capabilities are actually built.

## Explicitly Not Yet Decided

- Specific cloud/hosting provider
- Specific CI/CD platform (e.g., GitHub Actions, GitLab CI) — direction only, no commitment yet
- Object/file storage provider
- Monitoring and logging tooling
- Email/notification delivery provider

These will be addressed in `INFRASTRUCTURE.md` at a direction level, and finalized only when a phase requires the decision.

## Rationale for Stack Direction

- A single primary language (TypeScript) across frontend and backend reduces cognitive overhead and tooling duplication.
- NestJS's module system maps naturally onto a **modular monolith** (see `SYSTEM-ARCHITECTURE.md`), giving clear boundaries now and a realistic path to extracting services later if justified.
- PostgreSQL with Prisma provides strong relational integrity, which matters for financial data (billing, payments) and multi-tenant data ownership.
- Docker-based development keeps environments consistent across contributors and across phases, including AI-driven development handoffs (see `AI-HANDOFF-GUIDE.md`).
