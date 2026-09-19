import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * Onboards a new hotel tenant plus its first (Hotel Administrator) user.
 * There is intentionally no "select a tenant" step anywhere in auth: the
 * tenant a user belongs to is fixed at creation and later derived
 * server-side from the authenticated user, never from client input
 * (see /docs/MULTI-TENANCY.md — "Tenant context derived server-side").
 */
export class RegisterTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  tenantName: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  @MinLength(2)
  @MaxLength(60)
  tenantSlug: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(10, { message: 'password must be at least 10 characters' })
  @MaxLength(128)
  adminPassword: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;
}
