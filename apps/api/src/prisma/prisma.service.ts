import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around PrismaClient, registered as a Nest provider so it
 * can be injected wherever database access is needed.
 *
 * Phase 1 scope: connection lifecycle and a health-check query only.
 * Tenant-scoped query enforcement (see /docs/MULTI-TENANCY.md) is
 * introduced in Phase 2 alongside the Identity & Access module — do
 * not add business queries directly against this service outside that
 * plan.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
