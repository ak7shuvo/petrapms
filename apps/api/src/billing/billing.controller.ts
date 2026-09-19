import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../identity/identity.types';
import { BillingService } from './billing.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { AddLineItemDto } from './dto/add-line-item.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

/**
 * Billing & Payments controller.
 * Routes:
 *  GET  /v1/hotels/:hotelId/invoices
 *  GET  /v1/hotels/:hotelId/invoices/:invoiceId
 *  GET  /v1/hotels/:hotelId/stays/:stayId/invoice
 *  POST /v1/hotels/:hotelId/stays/:stayId/invoice/generate
 *  POST /v1/hotels/:hotelId/invoices/:invoiceId/line-items
 *  POST /v1/hotels/:hotelId/invoices/:invoiceId/issue
 *  POST /v1/hotels/:hotelId/invoices/:invoiceId/void
 *  POST /v1/hotels/:hotelId/invoices/:invoiceId/payments
 *  POST /v1/hotels/:hotelId/invoices/:invoiceId/payments/:paymentId/void
 */
@Controller('hotels/:hotelId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @RequirePermissions('billing.read')
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ) {
    return this.billingService.listInvoices(user, hotelId);
  }

  @Get('invoices/:invoiceId')
  @RequirePermissions('billing.read')
  getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billingService.getInvoice(user, hotelId, invoiceId);
  }

  @Get('stays/:stayId/invoice')
  @RequirePermissions('billing.read')
  getInvoiceByStay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('stayId', ParseUUIDPipe) stayId: string,
  ) {
    return this.billingService.getInvoiceByStay(user, hotelId, stayId);
  }

  @Post('stays/:stayId/invoice/generate')
  @RequirePermissions('billing.manage')
  generateInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('stayId', ParseUUIDPipe) stayId: string,
    @Body() dto: GenerateInvoiceDto,
  ) {
    return this.billingService.generateInvoice(user, hotelId, stayId, dto);
  }

  @Post('invoices/:invoiceId/line-items')
  @RequirePermissions('billing.manage')
  addLineItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: AddLineItemDto,
  ) {
    return this.billingService.addLineItem(user, hotelId, invoiceId, dto);
  }

  @Post('invoices/:invoiceId/issue')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('billing.manage')
  issueInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billingService.issueInvoice(user, hotelId, invoiceId);
  }

  @Post('invoices/:invoiceId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('billing.manage')
  voidInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billingService.voidInvoice(user, hotelId, invoiceId);
  }

  @Post('invoices/:invoiceId/payments')
  @RequirePermissions('payments.manage')
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billingService.recordPayment(user, hotelId, invoiceId, dto);
  }

  @Post('invoices/:invoiceId/payments/:paymentId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payments.manage')
  voidPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.billingService.voidPayment(user, hotelId, invoiceId, paymentId);
  }
}
