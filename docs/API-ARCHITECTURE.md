# PROPETRA — API Architecture

> **Status: Proposed philosophy and examples.** No API has been implemented yet.

## Approach

PROPETRA exposes a **REST API** from the NestJS backend, consumed by the Next.js frontend (and, in principle, any future client). GraphQL and other API styles are not currently planned but are not permanently excluded either.

## Versioning

- The API is versioned from the start (e.g., a `/v1/` prefix) so future breaking changes do not disrupt existing clients.

## Authentication & Authorization

- Every non-public endpoint requires a valid authenticated session/token.
- Every tenant-data endpoint additionally resolves and enforces tenant context (see `MULTI-TENANCY.md`) and required role/permission (see `USER-ROLES.md`).

## Tenant Context

- The tenant associated with a request is derived server-side from the authenticated user, not from client-supplied identifiers, to prevent tenant-spoofing.

## Error Handling

- Errors follow a consistent response shape (status code, error code/type, human-readable message).
- Internal error details (stack traces, raw database errors) are never exposed to clients.

## Validation

- Request payloads are validated against explicit schemas/DTOs before reaching business logic; invalid requests are rejected with clear validation errors.

## Pagination, Filtering, Sorting

- List endpoints support pagination by default to avoid unbounded result sets.
- Filtering and sorting parameters are explicit and validated, not passed through to the database unchecked.

## Response Structure

- Responses use a consistent envelope (e.g., `{ data, meta }` for lists; `{ data }` for single resources), finalized at implementation time.

## Logging

- Each API request is logged with enough context (route, tenant, user, outcome) to support debugging and audit needs, without logging sensitive payload contents unnecessarily.

## Representative Endpoint Examples (Illustrative Only)

```text
POST   /v1/auth/login
GET    /v1/hotels/:hotelId/rooms
POST   /v1/hotels/:hotelId/reservations
GET    /v1/hotels/:hotelId/reservations/:id
PATCH  /v1/hotels/:hotelId/reservations/:id
GET    /v1/hotels/:hotelId/guests
POST   /v1/hotels/:hotelId/invoices/:id/payments
GET    /v1/admin/tenants
```

These illustrate the intended shape (tenant-scoped resource paths, a separate `/admin` namespace for TEAM PETRA operations) — the full API surface will be defined module by module during implementation, not built upfront.

## Explicitly Not Yet Decided

- Exact response envelope format.
- Whether `/admin` (TEAM PETRA) endpoints live in the same NestJS application or a logically separate module boundary within it (current direction: same modular monolith, separate module — see `MODULE-ARCHITECTURE.md`).
