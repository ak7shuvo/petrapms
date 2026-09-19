import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @IsUUID()
  guestId: string;

  @IsUUID()
  roomId: string;

  /** ISO date (YYYY-MM-DD); time-of-day is not modeled for reservations. */
  @IsDateString()
  checkInDate: string;

  @IsDateString()
  checkOutDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  @Type(() => Number)
  children?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
