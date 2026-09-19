import {
  Body,
  Controller,
  Get,
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
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';

/**
 * Reservation endpoints under /v1/hotels/:hotelId/reservations.
 * All routes are tenant-scoped via the authenticated user's tenantId
 * (see /docs/MULTI-TENANCY.md).
 */
@Controller('hotels/:hotelId/reservations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @RequirePermissions('reservations.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() query: ListReservationsQueryDto,
  ) {
    return this.reservationsService.list(user, hotelId, query);
  }

  @Get(':reservationId')
  @RequirePermissions('reservations.read')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ) {
    return this.reservationsService.getOne(user, hotelId, reservationId);
  }

  @Post()
  @RequirePermissions('reservations.manage')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(user, hotelId, dto);
  }

  /** Field updates and validated status transitions (see reservations.service.ts). */
  @Patch(':reservationId')
  @RequirePermissions('reservations.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(user, hotelId, reservationId, dto);
  }

  /** Dedicated cancellation action — a common, explicit front-desk operation. */
  @Post(':reservationId/cancel')
  @RequirePermissions('reservations.manage')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ) {
    return this.reservationsService.cancel(user, hotelId, reservationId);
  }
}
