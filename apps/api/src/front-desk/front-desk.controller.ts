import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../identity/identity.types';
import { FrontDeskService } from './front-desk.service';
import { CheckInDto } from './dto/check-in.dto';
import { ListStaysQueryDto } from './dto/list-stays-query.dto';

/**
 * Front Desk endpoints under /v1/hotels/:hotelId/stays (see
 * /docs/API-ARCHITECTURE.md and /docs/DEVELOPMENT-PHASES.md, Phase 5).
 *
 * Route order matters here: `arrivals` and `departures` are literal
 * segments and must be registered before the `:stayId` param route, or
 * Nest would try to parse "arrivals"/"departures" as a stay UUID.
 */
@Controller('hotels/:hotelId/stays')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FrontDeskController {
  constructor(private readonly frontDeskService: FrontDeskService) {}

  /** Confirmed reservations due (or overdue) to check in, not yet checked in. */
  @Get('arrivals')
  @RequirePermissions('stays.read')
  arrivals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ) {
    return this.frontDeskService.arrivals(user, hotelId);
  }

  /** Active stays due (or overdue) to check out today. */
  @Get('departures')
  @RequirePermissions('stays.read')
  departures(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ) {
    return this.frontDeskService.departures(user, hotelId);
  }

  /** List stays; `?status=ACTIVE` is "current occupancy". */
  @Get()
  @RequirePermissions('stays.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() query: ListStaysQueryDto,
  ) {
    return this.frontDeskService.list(user, hotelId, query);
  }

  @Post('check-in')
  @RequirePermissions('stays.manage')
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.frontDeskService.checkIn(user, hotelId, dto);
  }

  @Get(':stayId')
  @RequirePermissions('stays.read')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('stayId', ParseUUIDPipe) stayId: string,
  ) {
    return this.frontDeskService.getOne(user, hotelId, stayId);
  }

  @Post(':stayId/check-out')
  @RequirePermissions('stays.manage')
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('stayId', ParseUUIDPipe) stayId: string,
  ) {
    return this.frontDeskService.checkOut(user, hotelId, stayId);
  }
}
