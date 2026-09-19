import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { ReportQueryDto } from './dto/report-query.dto';

/**
 * Reports service — read-only aggregation across existing entities.
 *
 * Tenant isolation guarantee: every query hard-filters on both
 * tenantId AND hotelId derived from the AuthenticatedUser. No
 * cross-tenant aggregate is ever possible (see /docs/MULTI-TENANCY.md).
 *
 * No new database entities are introduced in Phase 8 — all data comes
 * from existing tables (rooms, reservations, stays, invoices, payments).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped report data.',
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

  /** Normalise a date-range query, defaulting to the last 30 days. */
  private dateRange(dto: ReportQueryDto): { from: Date; to: Date } {
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    // End of the "to" day
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // ─── Occupancy Report ─────────────────────────────────────────────────────

  /**
   * Returns daily occupancy figures for the requested range.
   * Occupancy = rooms with an ACTIVE stay on that day / total rooms.
   * This is done in application code (not a single SQL aggregate) so the
   * logic is readable and testable; acceptable for the expected date ranges
   * (<= 90 days) in Phase 8.
   */
  async occupancyReport(
    caller: AuthenticatedUser,
    hotelId: string,
    dto: ReportQueryDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const { from, to } = this.dateRange(dto);

    const [totalRooms, stays] = await Promise.all([
      this.prisma.room.count({ where: { hotelId, tenantId } }),
      this.prisma.stay.findMany({
        where: {
          hotelId,
          tenantId,
          checkInAt: { lte: to },
          OR: [{ checkOutAt: null }, { checkOutAt: { gte: from } }],
        },
        select: { checkInAt: true, checkOutAt: true },
      }),
    ]);

    // Build a day-by-day series
    const days: { date: string; occupiedRooms: number; occupancyRate: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= to) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      const occupied = stays.filter(
        (s) =>
          s.checkInAt <= dayEnd &&
          (s.checkOutAt === null || s.checkOutAt >= dayStart),
      ).length;

      days.push({
        date: cursor.toISOString().slice(0, 10),
        occupiedRooms: occupied,
        occupancyRate:
          totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const avgOccupancy =
      days.length > 0
        ? Math.round(days.reduce((n, d) => n + d.occupancyRate, 0) / days.length)
        : 0;

    return {
      hotelId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      totalRooms,
      averageOccupancyRate: avgOccupancy,
      days,
    };
  }

  // ─── Revenue Report ───────────────────────────────────────────────────────

  /**
   * Aggregates invoice and payment totals for the period.
   * Groups revenue by day (invoice createdAt date) for charting.
   */
  async revenueReport(
    caller: AuthenticatedUser,
    hotelId: string,
    dto: ReportQueryDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const { from, to } = this.dateRange(dto);

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          hotelId,
          tenantId,
          createdAt: { gte: from, lte: to },
          status: { not: 'VOID' },
        },
        select: {
          totalAmount: true,
          paidAmount: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          hotelId,
          tenantId,
          paidAt: { gte: from, lte: to },
          voidedAt: null,
        },
        select: { amount: true, method: true, paidAt: true },
      }),
    ]);

    const totalInvoiced = invoices.reduce((n, i) => n + Number(i.totalAmount), 0);
    const totalCollected = payments.reduce((n, p) => n + Number(p.amount), 0);
    const totalOutstanding = invoices.reduce(
      (n, i) => n + Math.max(0, Number(i.totalAmount) - Number(i.paidAmount)),
      0,
    );

    // By-status breakdown
    const byStatus = invoices.reduce<Record<string, number>>((acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + Number(i.totalAmount);
      return acc;
    }, {});

    // By-method breakdown for payments
    const byMethod = payments.reduce<Record<string, number>>((acc, p) => {
      acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount);
      return acc;
    }, {});

    // Daily revenue series (by invoice creation date)
    const dailyMap = new Map<string, number>();
    for (const inv of invoices) {
      const day = inv.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(inv.totalAmount));
    }
    const days = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, invoiced]) => ({ date, invoiced }));

    return {
      hotelId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      totalInvoiced: +totalInvoiced.toFixed(2),
      totalCollected: +totalCollected.toFixed(2),
      totalOutstanding: +totalOutstanding.toFixed(2),
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      byStatus,
      byMethod,
      days,
    };
  }

  // ─── Stay Summary ─────────────────────────────────────────────────────────

  /**
   * Aggregates stay counts and average length-of-stay for the period.
   * Includes top rooms by stay count.
   */
  async staySummary(
    caller: AuthenticatedUser,
    hotelId: string,
    dto: ReportQueryDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const { from, to } = this.dateRange(dto);

    const stays = await this.prisma.stay.findMany({
      where: {
        hotelId,
        tenantId,
        checkInAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        room: { select: { id: true, number: true } },
        guest: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const completed = stays.filter((s) => s.status === 'COMPLETED');
    const lengths = completed
      .map((s) => {
        const out = s.checkOutAt ?? new Date();
        return (out.getTime() - s.checkInAt.getTime()) / (1000 * 60 * 60 * 24);
      })
      .filter((n) => n > 0);

    const avgLos =
      lengths.length > 0
        ? +(lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1)
        : 0;

    // Top rooms by stay count
    const roomCounts = stays.reduce<Record<string, { number: string; count: number }>>(
      (acc, s) => {
        const k = s.room.id;
        if (!acc[k]) acc[k] = { number: s.room.number, count: 0 };
        acc[k].count++;
        return acc;
      },
      {},
    );
    const topRooms = Object.values(roomCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      hotelId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      totalStays: stays.length,
      activeStays: stays.filter((s) => s.status === 'ACTIVE').length,
      completedStays: completed.length,
      averageLengthOfStay: avgLos,
      topRooms,
    };
  }

  // ─── Dashboard Summary ────────────────────────────────────────────────────

  /**
   * Single endpoint that powers the reports dashboard — combines
   * today's occupancy snapshot, MTD revenue, and recent stay count.
   */
  async dashboardSummary(caller: AuthenticatedUser, hotelId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalRooms, activeStays, mtdInvoices, mtdPayments, pendingCheckouts] =
      await Promise.all([
        this.prisma.room.count({ where: { hotelId, tenantId } }),
        this.prisma.stay.count({ where: { hotelId, tenantId, status: 'ACTIVE' } }),
        this.prisma.invoice.aggregate({
          where: {
            hotelId, tenantId,
            createdAt: { gte: monthStart },
            status: { not: 'VOID' },
          },
          _sum: { totalAmount: true },
          _count: true,
        }),
        this.prisma.payment.aggregate({
          where: {
            hotelId, tenantId,
            paidAt: { gte: monthStart },
            voidedAt: null,
          },
          _sum: { amount: true },
        }),
        // Stays checked in but not checked out, checkInAt before today
        this.prisma.stay.count({
          where: {
            hotelId, tenantId,
            status: 'ACTIVE',
            checkInAt: { lt: new Date(now.toISOString().slice(0, 10)) },
          },
        }),
      ]);

    return {
      hotelId,
      asOf: now.toISOString(),
      occupancy: {
        totalRooms,
        occupiedRooms: activeStays,
        rate: totalRooms > 0 ? Math.round((activeStays / totalRooms) * 100) : 0,
      },
      revenueMonthToDate: {
        invoiced: +(Number(mtdInvoices._sum.totalAmount ?? 0)).toFixed(2),
        collected: +(Number(mtdPayments._sum.amount ?? 0)).toFixed(2),
        invoiceCount: mtdInvoices._count,
      },
      pendingCheckouts,
    };
  }
}
