/**
 * Global permission catalog (shared reference data).
 *
 * Per /docs/USER-ROLES.md: additive and explicit — new modules introduce
 * new permissions, never overload existing ones.
 */
export interface PermissionDefinition {
  key: string;
  description: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  // Phase 2 — Identity & Access
  { key: 'identity.users.read', description: "Read users within the caller's own tenant." },
  { key: 'identity.users.manage', description: "Create, update, or disable users within the caller's own tenant." },
  { key: 'identity.roles.manage', description: "Manage roles and role assignments within the caller's own tenant." },
  // Phase 3 — Hotel Management
  { key: 'hotel.manage', description: "Create and update the hotel profile for the caller's own tenant." },
  // Phase 3 — Room Management
  { key: 'rooms.read', description: "View room types and rooms for the caller's own tenant." },
  { key: 'rooms.manage', description: "Create, update, and delete room types and rooms for the caller's own tenant." },
  // Phase 4 — Guest Management
  { key: 'guests.read', description: "View guest profiles for the caller's own tenant." },
  { key: 'guests.manage', description: "Create, update, and delete guest profiles for the caller's own tenant." },
  // Phase 4 — Reservation Management
  { key: 'reservations.read', description: "View reservations for the caller's own tenant." },
  { key: 'reservations.manage', description: "Create, update, and cancel reservations for the caller's own tenant." },
  // Phase 5 — Front Desk & Stay Operations
  { key: 'stays.read', description: "View stays (current and past occupancy) for the caller's own tenant." },
  { key: 'stays.manage', description: "Check guests in and out for the caller's own tenant." },
  // Phase 6 — Housekeeping
  { key: 'housekeeping.read', description: "View room housekeeping/readiness status for the caller's own tenant." },
  { key: 'housekeeping.manage', description: "Update room housekeeping/readiness status for the caller's own tenant." },
  // Phase 7 — Billing
  { key: 'billing.read', description: "View invoices for the caller's own tenant." },
  { key: 'billing.manage', description: "Generate and void invoices for the caller's own tenant." },
  // Phase 8 — Reports
  { key: 'reports.read', description: "View operational reports for the caller's own tenant." },
  // Phase 7 — Payments
  { key: 'payments.read', description: "View payments for the caller's own tenant." },
  { key: 'payments.manage', description: "Record and void payments for the caller's own tenant." },
];

/**
 * Default permission set for the "Hotel Administrator" role.
 * Bug fix (Phase 7): stays.read and stays.manage were missing from this
 * array despite being in the PERMISSIONS catalog since Phase 5.
 * All Phase 7 permissions added here.
 */
export const HOTEL_ADMINISTRATOR_PERMISSIONS: string[] = [
  'identity.users.read',
  'identity.users.manage',
  'identity.roles.manage',
  'hotel.manage',
  'rooms.read',
  'rooms.manage',
  'guests.read',
  'guests.manage',
  'reservations.read',
  'reservations.manage',
  'stays.read',        // fixed: was missing
  'stays.manage',      // fixed: was missing
  'housekeeping.read',
  'housekeeping.manage',
  'billing.read',
  'billing.manage',
  'payments.read',
  'payments.manage',
  'reports.read',
];

export const HOTEL_ADMINISTRATOR_ROLE_NAME = 'Hotel Administrator';
