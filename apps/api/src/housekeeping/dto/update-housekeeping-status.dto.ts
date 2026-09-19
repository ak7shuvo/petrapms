import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { HousekeepingState } from '@prisma/client';

export class UpdateHousekeepingStatusDto {
  @IsEnum(HousekeepingState)
  status: HousekeepingState;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
