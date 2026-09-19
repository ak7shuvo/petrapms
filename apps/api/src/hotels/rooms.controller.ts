import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../identity/identity.types';
import { RoomsService } from './rooms.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

/**
 * Room Management endpoints under /v1/hotels/:hotelId.
 * All routes are tenant-scoped via the authenticated user's tenantId.
 */
@Controller('hotels/:hotelId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // ─── Room Types ────────────────────────────────────────────────────────────

  @Get('room-types')
  @RequirePermissions('rooms.read')
  listRoomTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ) {
    return this.roomsService.listRoomTypes(user, hotelId);
  }

  @Post('room-types')
  @RequirePermissions('rooms.manage')
  createRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.roomsService.createRoomType(user, hotelId, dto);
  }

  @Patch('room-types/:roomTypeId')
  @RequirePermissions('rooms.manage')
  updateRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.roomsService.updateRoomType(user, hotelId, roomTypeId, dto);
  }

  @Delete('room-types/:roomTypeId')
  @RequirePermissions('rooms.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string,
  ) {
    return this.roomsService.deleteRoomType(user, hotelId, roomTypeId);
  }

  // ─── Rooms ─────────────────────────────────────────────────────────────────

  @Get('rooms')
  @RequirePermissions('rooms.read')
  listRooms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ) {
    return this.roomsService.listRooms(user, hotelId);
  }

  @Post('rooms')
  @RequirePermissions('rooms.manage')
  createRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.createRoom(user, hotelId, dto);
  }

  @Patch('rooms/:roomId')
  @RequirePermissions('rooms.manage')
  updateRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(user, hotelId, roomId, dto);
  }

  @Delete('rooms/:roomId')
  @RequirePermissions('rooms.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.deleteRoom(user, hotelId, roomId);
  }
}
