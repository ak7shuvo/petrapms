import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AdminService } from './admin/admin.service';

/**
 * PROPETRA API — bootstrap.
 *
 * Phase 10 additions (see docs/SECURITY-ARCHITECTURE.md):
 *  - helmet: security headers (X-Content-Type-Options, X-Frame-Options /
 *    frame-ancestors via CSP, Referrer-Policy, etc.).
 *  - cookie-parser: reads the httpOnly auth cookies (see
 *    identity/cookie.constants.ts).
 *  - AllExceptionsFilter: guarantees no stack trace, Prisma internals, or
 *    other server detail ever reaches a client response.
 *  - CORS tightened to a single configured origin with credentials —
 *    never a wildcard, since credentials: true would make a wildcard
 *    origin a serious cross-tenant/session-theft risk.
 *  - Startup fails fast (see identity/jwt.strategy.ts) if JWT_ACCESS_SECRET
 *    is unset; here we additionally warn if it looks like a development
 *    default, so that misconfiguration is visible in server logs before
 *    the first request rather than discovered later.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const secret = process.env.JWT_ACCESS_SECRET ?? '';
  if (
    process.env.NODE_ENV === 'production' &&
    (secret.length < 32 || secret.includes('replace-with') || secret.includes('dev'))
  ) {
    // Not fatal by itself (an operator may have a reason), but this is
    // exactly the kind of misconfiguration Section 27 of the Phase 10
    // brief asks to be caught — loud and in the startup log, not silent.
    logger.warn(
      'JWT_ACCESS_SECRET looks like a placeholder/development value in a production environment. ' +
        'Set a real random secret (e.g. `openssl rand -hex 32`) before accepting traffic.',
    );
  }

  app.use(helmet());
  app.use(cookieParser());

  // All routes are versioned from the start (see docs/API-ARCHITECTURE.md).
  app.setGlobalPrefix('v1');

  // Reject unknown/invalid fields rather than silently dropping or
  // passing them through to business logic (see docs/API-ARCHITECTURE.md).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const allowedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  // Bootstrap first platform admin if env vars are set (idempotent).
  // Carried over unchanged from the Phase 9 admin module.
  const adminService = app.get(AdminService);
  await adminService.bootstrapPlatformAdmin();

  const port = process.env.API_PORT ?? process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`PROPETRA API listening on port ${port} (CORS origin: ${allowedOrigin}).`);
}
bootstrap();
