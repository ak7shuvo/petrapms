import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/**
 * Billing & Payments module.
 * Owns: Invoice, InvoiceLineItem, Payment entities.
 * Per /docs/MODULE-ARCHITECTURE.md: depends on Stay (FrontDeskModule)
 * but does not import it directly — PrismaService provides cross-module
 * data access, keeping module dependencies unidirectional.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
