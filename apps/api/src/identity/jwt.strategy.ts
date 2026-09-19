import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload, AuthenticatedUser } from './identity.types';
import { ACCESS_TOKEN_COOKIE } from './cookie.constants';

/** Reads the access token from the httpOnly cookie set at login (Phase 10). */
function cookieExtractor(req: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      // Fail fast at boot rather than issuing/verifying tokens with an
      // undefined secret, which would be a critical auth bug.
      throw new Error('JWT_ACCESS_SECRET environment variable is not set.');
    }

    super({
      // Phase 10: accepts the token from either the httpOnly cookie (the
      // browser frontend's transport, see docs/SECURITY-ARCHITECTURE.md —
      // Token Storage) or a Bearer header (for non-browser API clients,
      // e.g. the e2e test suite and any future mobile/integration
      // clients) — cookie is tried first.
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: false,
    });
  }

  /**
   * Return value becomes `req.user`. Re-shapes the raw JWT payload into
   * `AuthenticatedUser` (the one type the rest of the codebase depends
   * on) and, for tenant accounts, re-checks the tenant's current status
   * against the database on every request.
   *
   * Phase 10 — suspended-tenant enforcement model (see
   * docs/SECURITY-ARCHITECTURE.md — Suspended Tenant Enforcement):
   * chosen deliberately as "immediate enforcement" rather than "enforced
   * only at next login". A tenant suspended mid-session is locked out of
   * every protected endpoint on their very next request, not just unable
   * to log in again — closing the gap Section 8 of the Phase 10 brief
   * calls out explicitly. The cost is one extra indexed lookup
   * (`tenant.findUnique` by primary key) per authenticated request;
   * accepted as the right trade-off for a security boundary rather than
   * caching staleness into the JWT payload.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (!payload.isPlatformAdmin && payload.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { status: true },
      });
      if (!tenant || tenant.status === 'SUSPENDED') {
        throw new UnauthorizedException(
          'This workspace has been suspended.',
        );
      }
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      isPlatformAdmin: payload.isPlatformAdmin,
      roleId: payload.roleId,
      email: payload.email,
    };
  }
}
