import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RoomStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @IsUUID()
  roomTypeId: string;

  @IsString()
  @MaxLength(20)
  number: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  floor?: number;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
