# PROPETRA — Development Phases

> **Status: Proposed roadmap.** Ten phases, each producing a working, visually usable increment of PROPETRA. Scope within a phase may be refined as work begins, but the overall sequence and dependency order should not be silently changed (see `DEVELOPMENT-RULES.md`).

## Roadmap Overview

| Phase | Name |
|---|---|
| 0 | Project Architecture & Master Documentation *(this document set)* |
| 1 | Foundation & Core Infrastructure |
| 2 | Identity, Authentication & Multi-Tenancy |
| 3 | Hotel, Property, Room & Inventory Management |
| 4 | Guest & Reservation Management |
| 5 | Front Desk & Stay Operations |
| 6 | Housekeeping |
| 7 | Billing & Payments |
| 8 | Reports, Notifications & Operational Tools |
| 9 | TEAM PETRA Central Administration & Hotel Onboarding |
| 10 | Production Hardening, Security, Testing & Launch |

---

### Phase 1 — Foundation & Core Infrastructure
- **Objective:** Establish the runnable skeleton of the system.
- **Scope:** Repository structure, Docker setup, NestJS app skeleton, Next.js app skeleton, PostgreSQL + Prisma connection, base CI pipeline.
- **Database work:** Initial Prisma setup, no business tables yet beyond a health-check or minimal placeholder.
- **Backend work:** Base NestJS module structure matching `MODULE-ARCHITECTURE.md`; health-check endpoint.
- **Frontend/UI work:** Base Next.js app shell with navigation placeholders matching `UI-UX-DIRECTION.md`.
- **API work:** Health-check endpoint; base API versioning structure.
- **Security considerations:** Environment variable handling, `.env.example`, no secrets committed.
- **Testing requirements:** Basic smoke tests confirming the app boots and connects to the database.
- **Expected deliverables:** A runnable, empty-but-structured application.
- **Definition of Done:** `docker-compose up` produces a working frontend and backend that can talk to the database; documentation and `PROJECT-STATE.md` updated.

### Phase 2 — Identity, Authentication & Multi-Tenancy
- **Objective:** Establish tenants, users, authentication, and tenant resolution.
- **Scope:** Tenant, User, Role, Permission entities; login; tenant resolution middleware; base RBAC.
- **Database work:** Tenant, User, Role, Permission tables and relationships (see `DATABASE-ARCHITECTURE.md`).
- **Backend work:** Identity & Access module; tenant resolution layer (see `MULTI-TENANCY.md`).
- **Frontend/UI work:** Login screen; basic authenticated shell showing the logged-in user's tenant.
- **API work:** `/v1/auth/*` endpoints.
- **Security considerations:** Credential hashing, session/token handling, tenant-isolation tests.
- **Testing requirements:** Automated tests proving one tenant cannot access another's data.
- **Expected deliverables:** Working login and a visibly tenant-scoped authenticated app shell.
- **Definition of Done:** A user can log in and see only their own tenant's (empty) workspace.

### Phase 3 — Hotel, Property, Room & Inventory Management
- **Objective:** Let a hotel configure its property and rooms.
- **Scope:** Hotel Management and Room Management modules.
- **Database work:** Hotel, Room Type, Room tables.
- **Backend work:** CRUD logic for hotel profile, room types, and rooms, tenant-scoped.
- **Frontend/UI work:** Hotel settings screen; room/room-type management screens.
- **API work:** `/v1/hotels/:hotelId/rooms` and related endpoints.
- **Security considerations:** Permission checks for who can modify property/room configuration.
- **Testing requirements:** CRUD and tenant-isolation tests for rooms/room types.
- **Expected deliverables:** A hotel admin can configure their property and see their room inventory.
- **Definition of Done:** Rooms created by one tenant never appear for another tenant.

### Phase 4 — Guest & Reservation Management
- **Objective:** Enable booking creation and guest record management.
- **Scope:** Guest Management and Reservation modules.
- **Database work:** Guest, Reservation tables.
- **Backend work:** Reservation logic including availability checking against Room Management.
- **Frontend/UI work:** Guest list/profile screens; reservation creation and calendar/availability view (see `UI-UX-DIRECTION.md`).
- **API work:** `/v1/hotels/:hotelId/guests`, `/v1/hotels/:hotelId/reservations`.
- **Security considerations:** Validation to prevent double-booking; permission checks.
- **Testing requirements:** Reservation logic tests, including edge cases (overlapping dates).
- **Expected deliverables:** A hotel can register guests and create/manage reservations visually.
- **Definition of Done:** A reservation can be created, viewed, edited, and canceled end-to-end through the UI.

### Phase 5 — Front Desk & Stay Operations
- **Objective:** Support check-in/check-out and active-stay operations.
- **Scope:** Front Desk module, Stay entity.
- **Database work:** Stay table, linked to Reservation.
- **Backend work:** Check-in/check-out logic transitioning Reservation → Stay.
- **Frontend/UI work:** Front desk dashboard showing arrivals/departures and check-in/out actions.
- **API work:** Stay-related endpoints under Front Desk.
- **Security considerations:** Role checks for who can perform check-in/out.
- **Testing requirements:** State-transition tests (reservation → stay → completed).
- **Expected deliverables:** A functioning front-desk workflow from booking to occupancy.
- **Definition of Done:** Staff can check a guest in and out through the UI, with state reflected accurately.

### Phase 6 — Housekeeping
- **Objective:** Track and manage room readiness.
- **Scope:** Housekeeping module.
- **Database work:** Housekeeping Status table linked to Room.
- **Backend work:** Status update logic, consumed by Front Desk for room assignment.
- **Frontend/UI work:** Housekeeping status board/room map (see `UI-UX-DIRECTION.md`).
- **API work:** Housekeeping status endpoints.
- **Security considerations:** Role checks limiting who can update housekeeping status.
- **Testing requirements:** Status-transition tests; integration check with Front Desk room assignment.
- **Expected deliverables:** A visual housekeeping board reflecting real room status.
- **Definition of Done:** Housekeeping staff can update room status and Front Desk reflects it in real time (or near-real time).

### Phase 7 — Billing & Payments
- **Objective:** Generate invoices and record payments for stays.
- **Scope:** Billing and Payments modules.
- **Database work:** Invoice, Payment tables linked to Stay.
- **Backend work:** Invoice generation logic; payment application with transactional integrity.
- **Frontend/UI work:** Invoice view; payment recording screen.
- **API work:** Invoice and payment endpoints.
- **Security considerations:** Strict transactional handling; permission checks for financial actions; audit logging of all financial events.
- **Testing requirements:** Transaction-integrity tests (no partial/inconsistent financial states).
- **Expected deliverables:** A hotel can generate an invoice for a completed stay and record payments against it.
- **Definition of Done:** A full stay can be billed and marked paid through the UI, with an accurate audit trail.

### Phase 8 — Reports, Notifications & Operational Tools
- **Objective:** Provide operational visibility and communication.
- **Scope:** Reports and Notifications modules.
- **Database work:** No new core entities expected; read-oriented queries across existing data.
- **Backend work:** Aggregation queries for occupancy, revenue, and operational reports; notification-sending logic (channel/provider to be decided).
- **Frontend/UI work:** Reports dashboard; notification-related UI (e.g., confirmation status).
- **API work:** Reporting endpoints.
- **Security considerations:** Ensure reports never leak cross-tenant aggregates.
- **Testing requirements:** Correctness tests for report calculations; tenant-isolation tests for aggregated data.
- **Expected deliverables:** A hotel can view meaningful operational reports.
- **Definition of Done:** Core reports (occupancy, revenue) are visible and accurate for a tenant's own data only.

### Phase 9 — TEAM PETRA Central Administration & Hotel Onboarding
- **Objective:** Enable TEAM PETRA to onboard and administer tenants centrally.
- **Scope:** Administration (TEAM PETRA) module.
- **Database work:** Platform-level admin structures; formalized tenant-provisioning flow.
- **Backend work:** Tenant creation/provisioning logic; platform-level monitoring/visibility (operational, not tenant content).
- **Frontend/UI work:** TEAM PETRA admin console, clearly separated from tenant-facing UI (see `UI-UX-DIRECTION.md`).
- **API work:** `/v1/admin/*` endpoints.
- **Security considerations:** Strict separation of platform-admin privileges from tenant roles; audited access.
- **Testing requirements:** Tests confirming platform admins cannot casually access tenant business data outside defined support workflows.
- **Expected deliverables:** TEAM PETRA can onboard a new hotel end-to-end through the admin console.
- **Definition of Done:** A new tenant can be provisioned and made operational without direct database intervention.

### Phase 10 — Production Hardening, Security, Testing & Launch
- **Objective:** Prepare PROPETRA for real hotel clients.
- **Scope:** Security review, performance review, monitoring/logging finalization, backup/restore verification.
- **Database work:** Index review, backup/restore drills.
- **Backend work:** Rate limiting, hardened error handling, dependency/security audit.
- **Frontend/UI work:** Polish of empty/loading/error states; accessibility pass.
- **API work:** Final review of API surface for consistency.
- **Security considerations:** Full pass against `SECURITY-ARCHITECTURE.md`; penetration-style review if resourced.
- **Testing requirements:** End-to-end tests across core workflows; load/stress testing at a level appropriate to expected launch scale.
- **Expected deliverables:** A production-ready system.
- **Definition of Done:** PROPETRA can be safely onboarded with a first real hotel client.

## Phase Progression Principle

Each phase must leave PROPETRA visibly more usable than the phase before — not just more complete internally. Phases build strictly on the module and architectural boundaries defined in Phase 0 unless a documented, deliberate change is made (see `DEVELOPMENT-RULES.md`).
