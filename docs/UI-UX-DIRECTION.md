# PROPETRA — UI/UX Direction

> **Status: Proposed direction.** Intended to guide, not lock in, visual implementation details.

## Guiding Idea

PROPETRA should feel like a real, professional commercial hotel PMS — closer to the tools hotel staff already trust for daily operations — not a generic admin dashboard template or a tutorial-style CRUD interface.

## Design Principles

- **Clarity over decoration.** Staff use this software under time pressure (a guest waiting at the desk); the interface should prioritize speed and clarity over visual flourish.
- **Operational focus.** Screens are organized around real hotel workflows (checking in a guest, assigning a room, closing a bill), not just around database entities.
- **Consistency across modules.** Shared patterns for tables, forms, and status indicators so staff moving between modules don't need to relearn the interface.

## Navigation Structure (Direction)

- A persistent primary navigation reflecting core modules (Front Desk, Reservations, Housekeeping, Billing, Reports, Administration).
- Contextual, in-page navigation for module-specific workflows (e.g., a reservation detail view).
- A separate, clearly distinguished navigation/interface for TEAM PETRA's central administration, so hotel staff and platform administrators never share a visual context that could cause confusion about scope of access.

## Dashboard Philosophy

- The hotel-facing dashboard should surface what matters *today* — arrivals, departures, room status — rather than acting as a generic analytics landing page.
- The TEAM PETRA administration dashboard should surface platform health and tenant status, not tenant operational detail.

## Desktop-First, Responsive-Aware

- Primary usage is expected at the front desk / back office on desktop-class screens; the interface is designed desktop-first.
- Core views should remain usable on tablets for staff mobility (e.g., housekeeping updates); full parity on small mobile screens is not an initial requirement.

## Typography & Color Philosophy (Direction Only)

- Typography should prioritize legibility for dense operational data (tables, schedules).
- Color is used functionally (status indicators) more than decoratively, so meaning is consistent and quickly scannable.
- Specific typefaces, palettes, and design tokens are intentionally left undefined here to avoid locking in visual decisions prematurely; these will be established when frontend implementation begins.

## Tables

- Dense, sortable, filterable tables are a primary interface pattern (reservations lists, guest lists, room lists).

## Forms

- Forms should validate inline and communicate errors clearly and immediately, given the operational, time-sensitive context of use.

## Modals

- Reserved for focused, short-lived tasks (e.g., quick room-status change) rather than long multi-step flows, which should be full pages instead.

## Status Indicators

- Room status (clean/dirty/occupied/out-of-service), reservation status, and invoice/payment status all need clear, consistent, at-a-glance visual treatment.

## Booking / Calendar Interfaces

- A calendar or grid-based view of room availability/bookings is expected to be a central interface element, given the nature of reservation management.

## Room-Status Visualization

- A visual room map/grid (by floor or section) is a likely pattern for housekeeping and front-desk workflows, showing status at a glance.

## Empty, Loading, and Error States

- Every list/data view needs designed empty, loading, and error states from the start — these are treated as part of the feature, not an afterthought.

## Explicitly Not Yet Decided

- Specific design system, component library, color palette, or typography choices.
- Whether a full design system document/style guide will be produced separately once implementation begins.
