import { IsInt, IsOptional, IsString, Max as MaxNum, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * List endpoints support pagination by default to avoid unbounded result
 * sets (see /docs/API-ARCHITECTURE.md — Pagination, Filtering, Sorting).
 * Guest volumes can grow far larger than Phase 3's room inventory, so
 * pagination is introduced here rather than the plain-array shape used
 * for rooms/room-types.
 */
export class ListGuestsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @MaxNum(100)
  @Type(() => Number)
  limit?: number = 25;

  /** Free-text search across first name, last name, and email. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
