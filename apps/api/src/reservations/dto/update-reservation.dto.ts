import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { ReservationStatus } from '@prisma/client';
import { CreateReservationDto } from './create-reservation.dto';

/**
 * All booking fields are optional on update. `status` is additionally
 * accepted here but is only ever applied through ReservationsService's
 * transition validation (see reservations.service.ts — ALLOWED_TRANSITIONS)
 * — never written to the database unchecked.
 */
export class UpdateReservationDto extends PartialType(CreateReservationDto) {
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
