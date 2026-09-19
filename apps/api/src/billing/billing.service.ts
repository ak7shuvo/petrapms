import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { AddLineItemDto } from './dto/add-line-item.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

/**
 * Billing — invoice generation and payment recording.
 *
 * Financial integrity guarantee: every operation that mutates both an
 * Invoice and a Payment (or multiple rows) runs inside a single Prisma
 * transaction. No partial writes are possible (see
 * /docs/SECURITY-ARCHITECTURE.md — Database Security and
 * /docs/DATABASE-ARCHITECTURE.md — Constraints and Integrity Principles).
 *
 * Tenant isolation: tenantId always comes from AuthenticatedUser, never
 * from the request body or route params alone (see /docs/MULTI-TENANCY.md).
 */
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped billing data.',
      );
    }
    return caller.tenantId;
  }

  private async resolveHotel(tenantId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, tenantId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');
    return hotel;
  }

  private async resolveInvoice(tenantId: string, hotelId: string, invoiceId: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, hotelId, tenantId },
      include: {
        lineItems: { orderBy: { createdAt: 'asc' } },
        payments: { where: { voidedAt: null }, orderBy: { paidAt: 'asc' } },
        stay: {
          select: {
            id: true, status: true, checkInAt: true, checkOutAt: true,
            guest: { select: { id: true, firstName: true, lastName: true } },
            room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found.');
    return inv;
  }

  // ─── Invoice Queries ──────────────────────────────────────────────────────

  async listInvoices(caller: AuthenticatedUser, hotelId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const invoices = await this.prisma.invoice.findMany({
      where: { hotelId, tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        stay: {
          select: {
            guest: { select: { firstName: true, lastName: true } },
            room: { select: { number: true } },
          },
        },
        _count: { select: { payments: true } },
      },
    });
    return invoices.map((inv) => this.shapeInvoiceList(inv));
  }

  async getInvoice(caller: AuthenticatedUser, hotelId: string, invoiceId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const inv = await this.resolveInvoice(tenantId, hotelId, invoiceId);
    return this.shapeInvoiceDetail(inv);
  }

  async getInvoiceByStay(caller: AuthenticatedUser, hotelId: string, stayId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const stay = await this.prisma.stay.findFirst({ where: { id: stayId, hotelId, tenantId } });
    if (!stay) throw new NotFoundException('Stay not found.');
    const inv = await this.prisma.invoice.findFirst({
      where: { stayId, tenantId },
      include: {
        lineItems: { orderBy: { createdAt: 'asc' } },
        payments: { where: { voidedAt: null }, orderBy: { paidAt: 'asc' } },
        stay: {
          select: {
            id: true, status: true, checkInAt: true, checkOutAt: true,
            guest: { select: { id: true, firstName: true, lastName: true } },
            room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('No invoice for this stay yet.');
    return this.shapeInvoiceDetail(inv);
  }

  // ─── Invoice Generation ───────────────────────────────────────────────────

  /**
   * Generate an invoice for a stay. Auto-creates a room-rate line item
   * based on the stay duration and the room type's base rate.
   * One invoice per stay is enforced by the unique index on stayId.
   */
  async generateInvoice(
    caller: AuthenticatedUser,
    hotelId: string,
    stayId: string,
    dto: GenerateInvoiceDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);

    const stay = await this.prisma.stay.findFirst({
      where: { id: stayId, hotelId, tenantId },
      include: {
        room: { include: { roomType: true } },
        guest: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!stay) throw new NotFoundException('Stay not found.');

    const existing = await this.prisma.invoice.findUnique({ where: { stayId } });
    if (existing) {
      throw new ConflictException('An invoice already exists for this stay.');
    }

    // Compute room-rate line item
    const checkIn = stay.checkInAt;
    const checkOut = stay.checkOutAt ?? new Date();
    const nights = Math.max(
      1,
      Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const rate = Number(stay.room.roomType.baseRate);
    const lineAmount = new Prisma.Decimal(rate * nights);
    const total = lineAmount;

    const inv = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          hotelId,
          stayId,
          status: InvoiceStatus.DRAFT,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes,
          totalAmount: total,
          paidAmount: new Prisma.Decimal(0),
          lineItems: {
            create: {
              tenantId,
              description: `Room ${stay.room.number} — ${stay.room.roomType.name} × ${nights} night${nights !== 1 ? 's' : ''}`,
              quantity: new Prisma.Decimal(nights),
              unitPrice: new Prisma.Decimal(rate),
              amount: lineAmount,
            },
          },
        },
        include: {
          lineItems: true,
          payments: true,
          stay: {
            select: {
              id: true, status: true, checkInAt: true, checkOutAt: true,
              guest: { select: { id: true, firstName: true, lastName: true } },
              room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
            },
          },
        },
      });
      return invoice;
    });

    return this.shapeInvoiceDetail(inv);
  }

  /**
   * Add an extra charge line item to a DRAFT invoice.
   * Recalculates totalAmount transactionally.
   */
  async addLineItem(
    caller: AuthenticatedUser,
    hotelId: string,
    invoiceId: string,
    dto: AddLineItemDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const inv = await this.resolveInvoice(tenantId, hotelId, invoiceId);
    if (inv.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Line items can only be added to DRAFT invoices.');
    }

    const lineAmount = new Prisma.Decimal(dto.quantity * dto.unitPrice);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.create({
        data: {
          tenantId,
          invoiceId,
          description: dto.description,
          quantity: new Prisma.Decimal(dto.quantity),
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          amount: lineAmount,
        },
      });
      const newTotal = new Prisma.Decimal(Number(inv.totalAmount) + Number(lineAmount));
      return tx.invoice.update({
        where: { id: invoiceId },
        data: { totalAmount: newTotal },
        include: {
          lineItems: { orderBy: { createdAt: 'asc' } },
          payments: { where: { voidedAt: null } },
          stay: {
            select: {
              id: true, status: true, checkInAt: true, checkOutAt: true,
              guest: { select: { id: true, firstName: true, lastName: true } },
              room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
            },
          },
        },
      });
    });
    return this.shapeInvoiceDetail(updated);
  }

  /**
   * Issue a DRAFT invoice — moves it to ISSUED status and stamps issuedAt.
   */
  async issueInvoice(caller: AuthenticatedUser, hotelId: string, invoiceId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const inv = await this.resolveInvoice(tenantId, hotelId, invoiceId);
    if (inv.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be issued.');
    }
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.ISSUED, issuedAt: new Date() },
      include: {
        lineItems: { orderBy: { createdAt: 'asc' } },
        payments: { where: { voidedAt: null } },
        stay: {
          select: {
            id: true, status: true, checkInAt: true, checkOutAt: true,
            guest: { select: { id: true, firstName: true, lastName: true } },
            room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
          },
        },
      },
    });
    return this.shapeInvoiceDetail(updated);
  }

  /**
   * Void an invoice. Simultaneously voids all active payments against it.
   * Uses a transaction to ensure no orphaned payment state.
   */
  async voidInvoice(caller: AuthenticatedUser, hotelId: string, invoiceId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const inv = await this.resolveInvoice(tenantId, hotelId, invoiceId);
    if (inv.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is already voided.');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { invoiceId, voidedAt: null },
        data: { voidedAt: now },
      });
      return tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.VOID, paidAmount: new Prisma.Decimal(0) },
        include: {
          lineItems: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { paidAt: 'asc' } },
          stay: {
            select: {
              id: true, status: true, checkInAt: true, checkOutAt: true,
              guest: { select: { id: true, firstName: true, lastName: true } },
              room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
            },
          },
        },
      });
    });
    return this.shapeInvoiceDetail(updated);
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  /**
   * Record a payment against an invoice.
   * Updates Invoice.paidAmount and recalculates Invoice.status atomically.
   * Overpayment is allowed (paidAmount > totalAmount) — a hotel may
   * collect a deposit and reconcile later.
   */
  async recordPayment(
    caller: AuthenticatedUser,
    hotelId: string,
    invoiceId: string,
    dto: RecordPaymentDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const inv = await this.resolveInvoice(tenantId, hotelId, invoiceId);

    if (inv.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Cannot record payment against a voided invoice.');
    }
    if (inv.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException('Issue the invoice before recording payments.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          hotelId,
          invoiceId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
        },
      });

      const newPaid = new Prisma.Decimal(Number(inv.paidAmount) + dto.amount);
      const newStatus = this.computeInvoiceStatus(Number(inv.totalAmount), Number(newPaid));

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaid, status: newStatus },
        include: {
          lineItems: { orderBy: { createdAt: 'asc' } },
          payments: { where: { voidedAt: null }, orderBy: { paidAt: 'asc' } },
          stay: {
            select: {
              id: true, status: true, checkInAt: true, checkOutAt: true,
              guest: { select: { id: true, firstName: true, lastName: true } },
              room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
            },
          },
        },
      });

      return { invoice: updated, payment };
    });

    return {
      invoice: this.shapeInvoiceDetail(result.invoice),
      payment: this.shapePayment(result.payment),
    };
  }

  /**
   * Void a single payment. Updates Invoice.paidAmount and status atomically.
   */
  async voidPayment(
    caller: AuthenticatedUser,
    hotelId: string,
    invoiceId: string,
    paymentId: string,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const inv = await this.resolveInvoice(tenantId, hotelId, invoiceId);

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, invoiceId, tenantId },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (payment.voidedAt) throw new BadRequestException('Payment is already voided.');
    if (inv.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is already voided; payment cannot be individually voided.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const voided = await tx.payment.update({
        where: { id: paymentId },
        data: { voidedAt: new Date() },
      });

      const newPaid = new Prisma.Decimal(
        Math.max(0, Number(inv.paidAmount) - Number(payment.amount)),
      );
      const newStatus = this.computeInvoiceStatus(Number(inv.totalAmount), Number(newPaid));

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaid, status: newStatus },
        include: {
          lineItems: { orderBy: { createdAt: 'asc' } },
          payments: { where: { voidedAt: null }, orderBy: { paidAt: 'asc' } },
          stay: {
            select: {
              id: true, status: true, checkInAt: true, checkOutAt: true,
              guest: { select: { id: true, firstName: true, lastName: true } },
              room: { select: { id: true, number: true, roomType: { select: { name: true, baseRate: true } } } },
            },
          },
        },
      });
      return { invoice: updated, payment: voided };
    });

    return {
      invoice: this.shapeInvoiceDetail(result.invoice),
      payment: this.shapePayment(result.payment),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private computeInvoiceStatus(total: number, paid: number): InvoiceStatus {
    if (paid <= 0) return InvoiceStatus.ISSUED;
    if (paid >= total) return InvoiceStatus.PAID;
    return InvoiceStatus.PARTIALLY_PAID;
  }

  private shapeInvoiceList(inv: any) {
    return {
      id: inv.id,
      status: inv.status,
      totalAmount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      balanceDue: Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount)),
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      guest: inv.stay?.guest
        ? `${inv.stay.guest.firstName} ${inv.stay.guest.lastName}`
        : null,
      roomNumber: inv.stay?.room?.number ?? null,
      paymentCount: inv._count?.payments ?? 0,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    };
  }

  private shapeInvoiceDetail(inv: any) {
    return {
      id: inv.id,
      status: inv.status,
      totalAmount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      balanceDue: Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount)),
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      notes: inv.notes,
      stay: inv.stay
        ? {
            id: inv.stay.id,
            status: inv.stay.status,
            checkInAt: inv.stay.checkInAt,
            checkOutAt: inv.stay.checkOutAt,
            guest: inv.stay.guest,
            room: {
              id: inv.stay.room.id,
              number: inv.stay.room.number,
              roomType: {
                name: inv.stay.room.roomType.name,
                baseRate: Number(inv.stay.room.roomType.baseRate),
              },
            },
          }
        : null,
      lineItems: (inv.lineItems ?? []).map((li: any) => ({
        id: li.id,
        description: li.description,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        amount: Number(li.amount),
      })),
      payments: (inv.payments ?? []).map((p: any) => this.shapePayment(p)),
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    };
  }

  private shapePayment(p: any) {
    return {
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      paidAt: p.paidAt,
      voidedAt: p.voidedAt,
    };
  }
}
