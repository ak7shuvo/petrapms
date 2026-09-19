import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from '../common/guards/permissions.guard';

/**
 * Identity & Access — owns authentication, users, roles/permissions, and
 * the tenant-resolution mechanism (via JWT payload) that every other
 * module will depend on, per /docs/MODULE-ARCHITECTURE.md.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, UsersController],
  providers: [AuthService, UsersService, JwtStrategy, PermissionsGuard],
  exports: [UsersService],
})
export class IdentityModule {}
