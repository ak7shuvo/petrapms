import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../identity/identity.types';
import { HotelsService } from './hotels.service';
import { UpdateHotelDto } from './dto/update-hotel.dto';

/**
 * Hotel Management endpoints.
 * Phase 3 model: one hotel per tenant, accessed via /v1/hotels.
 */
@Controller('hotels')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  /** GET /v1/hotels — return this tenant's hotel profile. */
  @Get()
  @RequirePermissions('hotel.manage')
  getHotel(@CurrentUser() user: AuthenticatedUser) {
    return this.hotelsService.getHotel(user);
  }

  /** PATCH /v1/hotels — update hotel profile fields. */
  @Patch()
  @RequirePermissions('hotel.manage')
  patchHotel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHotelDto,
  ) {
    return this.hotelsService.upsertHotel(user, dto);
  }

  /** PUT /v1/hotels — create or fully replace hotel profile. */
  @Put()
  @RequirePermissions('hotel.manage')
  putHotel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHotelDto,
  ) {
    return this.hotelsService.upsertHotel(user, dto);
  }
}
