import { IsEnum, IsOptional } from 'class-validator';
import { StayStatus } from '@prisma/client';

/**
 * Filters the stays list. Omitting `status` returns everything (both
 * active and completed); `status=ACTIVE` is "current occupancy".
 */
export class ListStaysQueryDto {
  @IsOptional()
  @IsEnum(StayStatus)
  status?: StayStatus;
}
