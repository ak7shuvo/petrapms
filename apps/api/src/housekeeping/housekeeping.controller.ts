import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../identity/identity.types';
import { HousekeepingService } from './housekeeping.service';
import { UpdateHousekeepingStatusDto } from './dto/update-housekeeping-status.dto';

/**
 * Housekeeping endpoints under /v1/hotels/:hotelId/housekeeping.
 * All routes are tenant-scoped via the authenticated user's tenantId
 * (see /docs/MULTI-TENANCY.md).
 */
@Controller('hotels/:hotelId/housekeeping')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  /** GET /v1/hotels/:hotelId/housekeeping — the room status board. */
  @Get()
  @RequirePermissions('housekeeping.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ) {
    return this.housekeepingService.listForHotel(user, hotelId);
  }

  /** PATCH /v1/hotels/:hotelId/housekeeping/:roomId — update one room's status. */
  @Patch(':roomId')
  @RequirePermissions('housekeeping.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateHousekeepingStatusDto,
  ) {
    return this.housekeepingService.updateForRoom(user, hotelId, roomId, dto);
  }
}
