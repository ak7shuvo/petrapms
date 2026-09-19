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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../identity/identity.types';
import { GuestsService } from './guests.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { ListGuestsQueryDto } from './dto/list-guests-query.dto';

/**
 * Guest Management endpoints under /v1/hotels/:hotelId/guests.
 * All routes are tenant-scoped via the authenticated user's tenantId
 * (see /docs/MULTI-TENANCY.md).
 */
@Controller('hotels/:hotelId/guests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @RequirePermissions('guests.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() query: ListGuestsQueryDto,
  ) {
    return this.guestsService.list(user, hotelId, query);
  }

  @Get(':guestId')
  @RequirePermissions('guests.read')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
  ) {
    return this.guestsService.getOne(user, hotelId, guestId);
  }

  @Post()
  @RequirePermissions('guests.manage')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateGuestDto,
  ) {
    return this.guestsService.create(user, hotelId, dto);
  }

  @Patch(':guestId')
  @RequirePermissions('guests.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestsService.update(user, hotelId, guestId, dto);
  }

  @Delete(':guestId')
  @RequirePermissions('guests.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
  ) {
    return this.guestsService.delete(user, hotelId, guestId);
  }
}
