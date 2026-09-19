import { Module } from '@nestjs/common';
import { HotelsModule } from '../hotels/hotels.module';
import { GuestsModule } from '../guests/guests.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

/**
 * Reservation module.
 * Owns: Reservation entity (see /docs/MODULE-ARCHITECTURE.md).
 * Depends on HotelsModule (for RoomsService — availability checking
 * against Room Management) and GuestsModule (for guest validation),
 * consistent with the dependency direction diagram in
 * /docs/MODULE-ARCHITECTURE.md: GM -> RES, RM -> RES.
 */
@Module({
  imports: [HotelsModule, GuestsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
