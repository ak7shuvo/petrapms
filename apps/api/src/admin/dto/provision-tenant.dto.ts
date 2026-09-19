import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Platform-admin-only tenant provisioning DTO.
 * Distinct from the self-service RegisterTenantDto: this endpoint is
 * called by TEAM PETRA, not by the hotel itself.
 */
export class ProvisionTenantDto {
  @IsString()
  @MaxLength(200)
  tenantName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'tenantSlug must be lowercase letters, numbers, and hyphens only.',
  })
  tenantSlug: string;

  @IsEmail()
  @MaxLength(200)
  adminEmail: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  adminPassword: string;

  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;
}
