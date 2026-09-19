import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  reservationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
