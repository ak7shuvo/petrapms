import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Reports module — read-only aggregation, no new DB entities.
 * Per /docs/MODULE-ARCHITECTURE.md: reads across multiple modules'
 * tables via PrismaService directly; no circular module imports.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
