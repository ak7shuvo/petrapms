import {
  Body,
  Controller,
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
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { AdminService } from './admin.service';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getTenant(id);
  }

  @Patch('tenants/:id/status')
  @HttpCode(HttpStatus.OK)
  updateTenantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.adminService.updateTenantStatus(id, dto);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  provisionTenant(@Body() dto: ProvisionTenantDto) {
    return this.adminService.provisionTenant(dto);
  }
}
