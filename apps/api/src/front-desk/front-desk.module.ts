import { Module } from '@nestjs/common';
import { HotelsModule } from '../hotels/hotels.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { FrontDeskController } from './front-desk.controller';
import { FrontDeskService } from './front-desk.service';

/**
 * Front Desk module.
 * Owns: Stay entity (see /docs/MODULE-ARCHITECTURE.md).
 * Depends on ReservationsModule (to validate/read the reservation being
 * checked in, and to drive its CONFIRMED -> COMPLETED transition at
 * check-out) and HotelsModule (for RoomsService — room operational
 * status on check-in/check-out), matching the dependency direction in
 * /docs/MODULE-ARCHITECTURE.md: RES -> FD, RM -> FD.
 */
@Module({
  imports: [HotelsModule, ReservationsModule],
  controllers: [FrontDeskController],
  providers: [FrontDeskService],
  exports: [FrontDeskService],
})
export class FrontDeskModule {}
