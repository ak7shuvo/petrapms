import { Module } from '@nestjs/common';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';

/**
 * Guest Management module.
 * Owns: Guest entity (see /docs/MODULE-ARCHITECTURE.md).
 * GuestsService is exported so ReservationsModule can resolve/validate
 * a guestId against the owning hotel/tenant without querying the
 * `guests` table directly (module boundary — see MODULE-ARCHITECTURE.md,
 * "Module Interaction Principles").
 */
@Module({
  controllers: [GuestsController],
  providers: [GuestsService],
  exports: [GuestsService],
})
export class GuestsModule {}
