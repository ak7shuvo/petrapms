import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';

/**
 * Housekeeping module (Phase 6). Owns: HousekeepingStatus.
 * Depends on Room Management data (via Prisma) but does not modify
 * Room itself — see /docs/MODULE-ARCHITECTURE.md dependency diagram
 * (Room Management → Housekeeping → Front Desk).
 */
@Module({
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
