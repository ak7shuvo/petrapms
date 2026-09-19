import { CookieOptions } from 'express';

/**
 * httpOnly cookie-based token transport (Phase 10 — replaces the
 * Phase 2–9 `localStorage` approach flagged as a known issue in every
 * prior PROJECT-STATE.md). See docs/SECURITY-ARCHITECTURE.md — Token
 * Storage for the full rationale.
 */
export const ACCESS_TOKEN_COOKIE = 'propetra_access_token';
export const REFRESH_TOKEN_COOKIE = 'propetra_refresh_token';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * `sameSite: 'none'` is required for a cross-origin browser frontend
 * (web on one origin, API on another) to send the cookie at all — but
 * browsers only honor `SameSite=None` when the cookie is also `Secure`
 * (HTTPS). In non-production (plain http://localhost) we fall back to
 * `lax`, which still works because the frontend dev server proxies same-
 * site in practice for same-machine testing; production MUST be served
 * over HTTPS for `none` + `Secure` to function, which is documented as a
 * hard deployment requirement in docs/DEPLOYMENT.md.
 */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}

export function accessTokenCookieOptions(maxAgeMs: number): CookieOptions {
  return { ...baseCookieOptions(), maxAge: maxAgeMs };
}

export function refreshTokenCookieOptions(maxAgeMs: number): CookieOptions {
  // Scoped to the auth routes only — the refresh token is never needed
  // outside them, so it's never sent on ordinary API calls.
  return { ...baseCookieOptions(), maxAge: maxAgeMs, path: '/v1/auth' };
}

export function clearAuthCookieOptions(): CookieOptions {
  return { ...baseCookieOptions() };
}

export function clearRefreshCookieOptions(): CookieOptions {
  return { ...baseCookieOptions(), path: '/v1/auth' };
}
