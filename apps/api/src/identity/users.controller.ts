import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './identity.types';

/**
 * /v1/users — tenant-scoped user management (see /docs/USER-ROLES.md).
 * This is the reference implementation of "authenticated + tenant-scoped
 * + permission-checked" that later modules' controllers should mirror.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions('identity.users.read')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listForCallerTenant(user);
  }
}
