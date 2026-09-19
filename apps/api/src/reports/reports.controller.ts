import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../identity/identity.types';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

/**
 * Reports endpoints — all read-only, all require reports.read permission.
 * Routes:
 *   GET /v1/hotels/:hotelId/reports/summary
 *   GET /v1/hotels/:hotelId/reports/occupancy
 *   GET /v1/hotels/:hotelId/reports/revenue
 *   GET /v1/hotels/:hotelId/reports/stays
 */
@Controller('hotels/:hotelId/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('reports.read')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  dashboardSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ) {
    return this.reportsService.dashboardSummary(user, hotelId);
  }

  @Get('occupancy')
  occupancyReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() dto: ReportQueryDto,
  ) {
    return this.reportsService.occupancyReport(user, hotelId, dto);
  }

  @Get('revenue')
  revenueReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() dto: ReportQueryDto,
  ) {
    return this.reportsService.revenueReport(user, hotelId, dto);
  }

  @Get('stays')
  staySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() dto: ReportQueryDto,
  ) {
    return this.reportsService.staySummary(user, hotelId, dto);
  }
}
