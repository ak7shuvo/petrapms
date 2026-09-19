import { IsDateString, IsOptional } from 'class-validator';

/**
 * Common date-range query for all report endpoints.
 * Both dates are inclusive. If omitted, defaults to the last 30 days
 * (applied in the service, not here).
 */
export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
