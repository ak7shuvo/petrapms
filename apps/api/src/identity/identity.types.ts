/**
 * Shape of the JWT access-token payload. `tenantId` is the single source
 * of tenant context for every downstream request — it is set once at
 * login/registration from the database, signed into the token, and never
 * re-derived from anything the client sends afterwards (see
 * /docs/MULTI-TENANCY.md — "Tenant context derived server-side").
 */
export interface AccessTokenPayload {
  sub: string; // user id
  tenantId: string | null;
  isPlatformAdmin: boolean;
  roleId: string | null;
  email: string;
}

/**
 * What `req.user` is populated with after JwtAuthGuard runs. Every
 * tenant-scoped query in the application should take its tenantId from
 * this object — never from a route param, query string, or request body.
 */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
  roleId: string | null;
  email: string;
}
