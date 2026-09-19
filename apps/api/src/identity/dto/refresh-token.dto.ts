import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Phase 10: `refreshToken` is now optional in the body because the
 * browser frontend sends it via the httpOnly cookie instead (see
 * cookie.constants.ts). Still accepted in the body for non-browser API
 * clients. AuthController falls back to the cookie when the body omits
 * it, and rejects the request if neither is present.
 */
export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  refreshToken?: string;
}
