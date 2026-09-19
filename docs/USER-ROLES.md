# PROPETRA — User Roles

> **Status: Proposed initial role set.** Expected to evolve as modules are implemented.

## Two Categories of Users

1. **Hotel-Tenant Users** — belong to exactly one hotel tenant; their access is scoped entirely within that tenant's workspace.
2. **TEAM PETRA Platform Users** — belong to TEAM PETRA, not to any hotel; their access operates at the platform/administration level across tenants (see `MULTI-TENANCY.md`).

These two categories are never mixed in the same account.

## Proposed Hotel-Tenant Roles

| Role | Typical Responsibilities |
|---|---|
| **Hotel Administrator** | Manages the hotel's workspace configuration, staff accounts, and roles within the tenant. |
| **Front Desk / Reception** | Manages reservations, check-in/check-out, guest records. |
| **Housekeeping Staff** | Updates room housekeeping status. |
| **Billing / Accounts** | Manages invoices and payments. |
| **Manager / Reports Viewer** | Views operational and business reports without necessarily performing transactional actions. |

Roles are assigned per user, per tenant, and are composed of specific permissions (see `DATABASE-ARCHITECTURE.md`). The exact permission catalog will be finalized alongside each module's implementation (e.g., billing permissions defined when the Billing module is built).

## Proposed TEAM PETRA Platform Roles

| Role | Typical Responsibilities |
|---|---|
| **Platform Administrator** | Manages platform-wide configuration, onboarding, and system health. |
| **Support Agent** | Assists hotel clients; access to tenant data is limited and audited (exact model is a future consideration — see `MULTI-TENANCY.md`). |

## Role Design Principles

- Roles are always evaluated together with tenant context — a role name alone never grants cross-tenant access.
- The permission catalog should stay additive and explicit: new modules introduce new permissions rather than overloading existing ones with unrelated meaning.
- Role assignment and changes are themselves audit-logged (see `SECURITY-ARCHITECTURE.md`).

## Explicitly Not Yet Decided

- Whether hotels can define fully custom roles or only assign from a fixed set with fixed permissions.
- The complete, final permission catalog across all modules.
