import { Body, Controller, Get, Post, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './identity.types';
import { parseDurationMs } from './duration.util';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  clearAuthCookieOptions,
  clearRefreshCookieOptions,
} from './cookie.constants';

/**
 * /v1/auth/* — see /docs/API-ARCHITECTURE.md.
 * No tenant id ever appears in these routes or bodies: it is always
 * resolved server-side (see /docs/MULTI-TENANCY.md).
 *
 * Phase 10: tokens are set as httpOnly cookies (see cookie.constants.ts)
 * in addition to being returned in the JSON body. The body is kept for
 * backward compatibility with non-browser API clients (the e2e suite
 * included) that authenticate via `Authorization: Bearer`, which
 * JwtStrategy still accepts — see docs/SECURITY-ARCHITECTURE.md — Token
 * Storage.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const accessMaxAge = parseDurationMs(process.env.JWT_ACCESS_EXPIRES_IN ?? '15m');
    const refreshMaxAge = parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions(accessMaxAge));
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions(refreshMaxAge));
  }

  // Registration and login are the highest-value brute-force/enumeration
  // targets in the whole API — throttled tighter than the global default
  // (see app.module.ts ThrottlerModule config and
  // docs/SECURITY-ARCHITECTURE.md — Rate Limiting).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register-tenant')
  async registerTenant(
    @Body() dto: RegisterTenantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.registerTenant(dto);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = dto.refreshToken ?? req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!raw) throw new BadRequestException('No refresh token provided.');
    const tokens = await this.authService.refresh(raw);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @SkipThrottle()
  @Post('logout')
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = dto.refreshToken ?? req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (raw) await this.authService.logout(raw);
    res.clearCookie(ACCESS_TOKEN_COOKIE, clearAuthCookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshCookieOptions());
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    // Looks itself up by the id embedded in its own verified token only —
    // this is the pattern every tenant-scoped read in later modules
    // should follow.
    return this.usersService.getSelf(user);
  }
}
