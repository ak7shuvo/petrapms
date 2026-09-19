# PROPETRA — Multi-Tenancy Architecture

> **Status: Proposed.** This is the core design that everything else in the platform depends on. Treat changes to this document as significant architectural decisions.

## Key Concepts

| Term | Meaning |
|---|---|
| **Tenant** | A single hotel client using PROPETRA. The unit of isolation in the system. |
| **Hotel** | The business entity a tenant represents. In the early system, one tenant corresponds to one hotel; a group with multiple properties is a future consideration (see below). |
| **Hotel Workspace** | The complete set of data, users, and configuration belonging to one tenant. |
| **User** | An individual account, always associated with exactly one tenant, except TEAM PETRA administrative users. |
| **Role** | A named set of permissions assigned to users within a tenant (see `USER-ROLES.md`). |
| **Tenant Identification** | The mechanism by which an incoming request is associated with a specific tenant. |
| **Tenant Isolation** | The guarantee that one tenant can never read, modify, or infer another tenant's data. |
| **Central Administration** | The TEAM PETRA-level layer that operates across all tenants (see `PROJECT-SUMMARY.md` and `MODULE-ARCHITECTURE.md`). |

## Tenancy Model: Shared Database, Shared Schema, Tenant ID

**Proposed direction:** PROPETRA will use a **single shared PostgreSQL database and shared schema**, with every tenant-owned table carrying a `tenant_id` column, rather than a separate database or schema per hotel.

### Why this is appropriate for the initial system

- Hotels are expected to be numerous but individually moderate in data volume; a shared database avoids the operational overhead of provisioning, migrating, and monitoring a separate database per client.
- A single schema keeps migrations, backups, and monitoring centralized and consistent — directly supporting TEAM PETRA's role as the central platform operator.
- Prisma and PostgreSQL support row-level scoping patterns that make tenant filtering explicit and auditable in code.
- Most PMS platforms operate successfully at this scale with shared-schema multi-tenancy; a database-per-tenant model introduces meaningful operational complexity that is not currently justified.

### When a different model might be reconsidered

- A hotel client with unusual regulatory, contractual, or data-residency requirements.
- Extreme scale where a single database becomes a genuine bottleneck.

Either scenario would be a deliberate, explicitly documented architectural change — not a default assumption.

## Required Safeguards for Shared-Schema Isolation

1. **Mandatory tenant scoping.** Every query against tenant-owned data must include a `tenant_id` filter. No query path should be able to omit it.
2. **Tenant context derived server-side.** The tenant a request belongs to is derived from the authenticated session/token — never taken from client-supplied input (e.g., never from a request body or unchecked URL parameter).
3. **Centralized data-access layer.** Tenant scoping should be enforced in one consistent place (e.g., a base repository pattern or Prisma middleware) rather than repeated ad hoc in every query, to eliminate the risk of a forgotten filter.
4. **Database-level constraints as a second layer of defense.** Foreign keys and constraints should make it structurally difficult to associate one tenant's records with another tenant's data.
5. **Audit logging.** Sensitive or cross-cutting operations are logged with tenant context (see `SECURITY-ARCHITECTURE.md`).
6. **Testing discipline.** Tenant isolation should have explicit automated tests (e.g., "user from Tenant A cannot read/write Tenant B's data") as a standing requirement, not an afterthought.

## TEAM PETRA Central Administration

TEAM PETRA operates a layer above individual tenants:

- Onboarding new hotel tenants (provisioning a new workspace within the existing platform, not a new deployment).
- Managing platform-wide configuration, updates, and maintenance.
- Monitoring system health and tenant activity at an operational (not necessarily content) level.
- Providing customer support, which may require limited, audited access into a tenant's workspace under controlled conditions (exact support-access model is a **future consideration**).

Central administration accounts are distinct from hotel-tenant accounts and are themselves subject to strict access control (see `SECURITY-ARCHITECTURE.md` and `USER-ROLES.md`).

## Multi-Property Hotel Groups (Future Consideration)

The initial model treats one tenant as one hotel. Supporting a single hotel *group* with multiple properties under one account is a plausible future extension, but is **not part of the current design** and should not be assumed until explicitly scoped.

## Open / To Be Decided

- Exact mechanism for TEAM PETRA support staff to access a tenant's workspace when helping with an issue (temporary elevated access with audit trail is the likely direction, but not yet designed).
- Long-term data retention and deletion policy per tenant (e.g., what happens to a hotel's data if they leave the platform).
