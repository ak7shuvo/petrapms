import { IsEnum } from 'class-validator';

export enum TenantStatusAction {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatusAction)
  status: TenantStatusAction;
}
