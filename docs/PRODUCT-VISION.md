# PROPETRA — Product Vision

## Vision Statement

PROPETRA will become a professional, commercial-grade, multi-tenant Property Management System that hotels trust to run their daily operations — reliable, secure, and simple enough that hotel staff can operate it without dedicated technical support.

## Why PROPETRA Exists

Hospitality businesses need dependable operational software, but building and maintaining that software in-house is costly and distracting from their core business — running a hotel. PROPETRA exists so that hotels can consume property management as a managed service, while TEAM PETRA focuses on the software so hotels can focus on hospitality.

## Product Principles

1. **Real product, not a demo.** Every architectural and design decision should assume real hotel operations: multiple concurrent users, real money, real guests, and real consequences for downtime or data loss.
2. **Tenant isolation is non-negotiable.** No hotel's data, users, or operations should ever be visible or reachable from another hotel's workspace.
3. **Foundation before features.** A stable, well-structured core matters more than a long feature list. Advanced infrastructure is introduced only when justified by real need.
4. **Incremental, usable progress.** Each development phase should leave PROPETRA in a state that is visibly more usable than before — not just more code.
5. **Documentation as a first-class artifact.** Architecture, decisions, and project state are documented continuously so that any developer — human or AI — can pick up the project with full context.
6. **Honesty about uncertainty.** Anything not yet decided is marked **Proposed**, **To Be Decided**, or **Future Consideration** rather than presented as final.

## What PROPETRA Is Not (For Now)

- Not a customization or rebrand of an existing PMS — it is built from the core.
- Not committed to microservices, a specific cloud provider, or a specific hosting model at this stage.
- Not scoped to include integrations, AI features, or advanced analytics in the initial phases — these are future considerations only.
- Not claiming any compliance certification (e.g., PCI-DSS, SOC 2) until such compliance work is explicitly undertaken.

## Success Looks Like

- A hotel can be onboarded onto PROPETRA and run its core operations (rooms, reservations, guests, billing, housekeeping, staff access) entirely within its own isolated workspace.
- TEAM PETRA can operate, monitor, update, and support multiple hotel tenants from a central administration layer.
- The platform can absorb new hotel tenants without architectural rework.
- The codebase and documentation remain coherent enough that a new developer (or AI) can understand the system from the documentation alone.
