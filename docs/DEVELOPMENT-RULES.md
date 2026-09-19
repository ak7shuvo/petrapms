# PROPETRA — Development Rules

> These rules apply to every contributor, human or AI, working on PROPETRA in any phase. They exist to protect architectural integrity, tenant security, and long-term maintainability.

## Core Rules

1. **Never rewrite working code unnecessarily.** Prefer extending or refactoring in place over wholesale rewrites, unless a rewrite is explicitly scoped and justified.
2. **Do not change dependencies without justification.** Adding, removing, or upgrading a dependency should have a clear, stated reason and should be reflected in documentation.
3. **Do not introduce microservices prematurely.** The system stays a modular monolith (see `SYSTEM-ARCHITECTURE.md`) unless a specific, documented scaling need justifies extracting a service.
4. **Maintain module boundaries.** Modules interact through defined interfaces, not by reaching into each other's data (see `MODULE-ARCHITECTURE.md`).
5. **Maintain tenant isolation at all times.** No change should ever make it possible for one tenant to read, write, or infer another tenant's data (see `MULTI-TENANCY.md`).
6. **Never expose tenant data across hotels.** This applies to APIs, logs, error messages, and support tooling alike.
7. **Never hardcode secrets.** All credentials and sensitive configuration go through environment variables, never committed to source control (see `SECURITY-ARCHITECTURE.md`).
8. **Use migrations for all database changes.** No manual schema edits against any real environment.
9. **Maintain type safety.** TypeScript types (and Prisma-generated types) should be used meaningfully, not bypassed with broad `any` types as a shortcut.
10. **Keep documentation updated.** Any architectural decision, module addition, or schema change is reflected in the relevant `/docs` file and in `PROJECT-STATE.md`.
11. **Do not implement features outside the current phase without permission.** Stay within the scope defined in `DEVELOPMENT-PHASES.md` for the active phase.
12. **Do not silently change architectural decisions.** If a documented decision (e.g., shared-schema multi-tenancy, modular monolith) needs to change, document the change explicitly and explain why — never drift from it quietly.
13. **Write tests for tenant-isolation-sensitive logic.** Any code path touching cross-tenant boundaries should have explicit tests proving isolation holds.
14. **Leave the repository in a coherent, runnable state at the end of every phase**, ready for handoff (see `AI-HANDOFF-GUIDE.md`).

## Process Expectations

- Inspect existing code and documentation before making changes — do not assume a clean slate after Phase 0.
- Reuse existing components and established patterns rather than introducing parallel, inconsistent approaches.
- Each phase should produce a working, visually usable increment (see `DEVELOPMENT-PHASES.md`) — not just backend code with no visible progress.
- Update `PROJECT-STATE.md` at the end of every phase (see `AI-HANDOFF-GUIDE.md`).
