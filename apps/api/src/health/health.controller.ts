import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * GET /v1/health
 *
 * Confirms the API is running and can reach the database. This is the
 * Phase 1 "Definition of Done" endpoint — see /docs/DEVELOPMENT-PHASES.md.
 * No authentication or tenant context applies to this endpoint.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let database: 'connected' | 'unreachable' = 'unreachable';

    try {
      // Lightweight connectivity check; not a business query.
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'unreachable';
    }

    return {
      status: 'ok',
      service: 'propetra-api',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
