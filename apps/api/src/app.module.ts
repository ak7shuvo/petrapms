import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';
import { HotelsModule } from './hotels/hotels.module';
import { GuestsModule } from './guests/guests.module';
import { ReservationsModule } from './reservations/reservations.module';
import { FrontDeskModule } from './front-desk/front-desk.module';
import { HousekeepingModule } from './housekeeping/housekeeping.module';
import { BillingModule } from './billing/billing.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';

/**
 * Root application module.
 *
 * Phase 10 note: AdminModule was merged in from a Phase 9 package that
 * had been built as a branch off the Phase 3 codebase rather than on top
 * of the full Phase 4–8 application (see PROJECT-STATE.md — "Canonical
 * Source Tree"). AdminModule itself only touches Tenant/User (Identity)
 * data, so the merge was a clean addition with no conflicts against the
 * Guest/Reservation/FrontDesk/Housekeeping/Billing/Reports modules below.
 *
 * Phase 10 also adds a global rate limit (see
 * docs/SECURITY-ARCHITECTURE.md — Rate Limiting): a generous default
 * ceiling applied to every endpoint via APP_GUARD, with auth.controller.ts
 * overriding tighter, endpoint-specific limits via @Throttle() on login/
 * register/refresh — the actual brute-force/enumeration targets.
 * Configurable via THROTTLE_TTL_MS / THROTTLE_LIMIT so limits can be
 * tuned per environment without a code change.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),
    PrismaModule, HealthModule, IdentityModule, HotelsModule,
    GuestsModule, ReservationsModule, FrontDeskModule,
    HousekeepingModule, BillingModule, ReportsModule, AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
