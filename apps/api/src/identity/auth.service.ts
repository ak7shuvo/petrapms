import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { AccessTokenPayload } from './identity.types';
import { parseDurationMs } from './duration.util';
import {
  HOTEL_ADMINISTRATOR_PERMISSIONS,
  HOTEL_ADMINISTRATOR_ROLE_NAME,
} from './permissions.constants';

const BCRYPT_SALT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Creates a new tenant and its first (Hotel Administrator) user in a
   * single transaction — Phase 2 has no separate "onboard tenant" admin
   * flow yet (that's TEAM PETRA Administration, a later module), so
   * self-service registration is the only tenant-creation path for now.
   */
  async registerTenant(dto: RegisterTenantDto): Promise<TokenPair> {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (existingSlug) {
      throw new ConflictException('That tenant slug is already in use.');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingEmail) {
      throw new ConflictException('That email is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_SALT_ROUNDS);

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: HOTEL_ADMINISTRATOR_PERMISSIONS } },
    });

    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug: dto.tenantSlug },
      });

      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: HOTEL_ADMINISTRATOR_ROLE_NAME,
          description: "Full administrative access to the tenant's workspace.",
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          roleId: adminRole.id,
        },
      });

      return { user, tenant };
    });

    return this.issueTokenPair({
      sub: user.id,
      tenantId: tenant.id,
      isPlatformAdmin: false,
      roleId: user.roleId,
      email: user.email,
    });
  }

  /**
   * Validates credentials without ever revealing whether the email exists
   * (see /docs/SECURITY-ARCHITECTURE.md — Password / Credential Security).
   */
  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    const genericError = () =>
      new UnauthorizedException('Invalid email or password.');

    if (!user || user.status !== 'ACTIVE') {
      // Still run a hash comparison against a dummy value so failure
      // timing doesn't distinguish "no such user" from "wrong password".
      await bcrypt.compare(dto.password, '$2b$12$invalidinvalidinvalidinuOe');
      throw genericError();
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw genericError();

    // Phase 10 fix (see PROJECT-STATE.md — Known Issues carried from
    // Phase 9): a suspended tenant must not be able to authenticate.
    // Checked after the password compare (not before) so a bad password
    // against a suspended tenant's account still returns the identical
    // generic "Invalid email or password" — suspension state is never
    // revealed to someone who doesn't already have valid credentials.
    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'This workspace has been suspended. Contact your administrator.',
      );
    }

    return this.issueTokenPair({
      sub: user.id,
      tenantId: user.tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
      roleId: user.roleId,
      email: user.email,
    });
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new
   * pair issued, so a leaked-and-reused refresh token is detectable
   * (reuse of an already-revoked token fails).
   */
  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { user } = stored;
    return this.issueTokenPair({
      sub: user.id,
      tenantId: user.tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
      roleId: user.roleId,
      email: user.email,
    });
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    // Best-effort revoke; do not leak whether the token existed.
    await this.prisma.refreshToken
      .update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  private async issueTokenPair(
    payload: AccessTokenPayload,
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    });

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const expiresAt = new Date(
      Date.now() + parseDurationMs(refreshExpiresIn),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tenantId: payload.tenantId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(raw: string): string {
    // Refresh tokens are opaque, high-entropy, and DB-stored — SHA-256 is
    // appropriate here (unlike passwords, there's no offline-guessing
    // concern for a 48-byte random token, so bcrypt's slowness buys
    // nothing and would only hurt refresh-endpoint latency).
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
