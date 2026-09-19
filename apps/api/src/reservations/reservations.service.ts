import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reservation, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { RoomsService } from '../hotels/rooms.service';
import { GuestsService } from '../guests/guests.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';

/**
 * Reservation lifecycle transitions. A status is only ever written to the
 * database via `applyStatusTransition` below, which consults this table —
 * never as a raw field assignment — so an invalid transition (e.g.
 * COMPLETED -> CONFIRMED) is rejected at the service layer regardless of
 * which endpoint triggered it (see /docs/DEVELOPMENT-PHASES.md - Phase 4
 * "reservation state transitions").
 */
const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  CANCELLED: [],
  COMPLETED: [],
};

/** Statuses that still hold a room for their date range. */
const ACTIVE_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED'];

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly guestsService: GuestsService,
  ) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped reservation data.',
      );
    }
    return caller.tenantId;
  }

  /** Resolves the hotel for this tenant, ensuring it exists and belongs here. */
  private async resolveHotel(tenantId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, tenantId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');
    return hotel;
  }

  /**
   * Resolves a reservation scoped to this tenant + hotel. Public (beyond
   * the CRUD methods below) for reuse by FrontDeskModule, which must
   * verify a reservationId belongs to this hotel/tenant — and inspect its
   * current status/guest/room — before checking a guest in. Per
   * /docs/MODULE-ARCHITECTURE.md, other modules access Reservation data
   * only through this service, never by querying the `reservations`
   * table directly.
   */
  async resolveReservation(
    tenantId: string,
    hotelId: string,
    reservationId: string,
  ) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, hotelId, tenantId },
      include: this.includeShape,
    });
    if (!reservation) throw new NotFoundException('Reservation not found.');
    return reservation;
  }

  private parseDateRange(checkInDate: string, checkOutDate: string) {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOutDate must be after checkInDate.');
    }
    return { checkIn, checkOut };
  }

  /**
   * Availability check: a room is unavailable for [checkIn, checkOut) if
   * any non-terminal (PENDING/CONFIRMED) reservation for that room overlaps
   * the range. Half-open interval comparison (existing.start < newEnd AND
   * existing.end > newStart) correctly allows back-to-back bookings
   * (one checking out the day another checks in).
   */
  private async assertAvailable(
    tenantId: string,
    hotelId: string,
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string,
  ) {
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        tenantId,
        hotelId,
        roomId,
        status: { in: ACTIVE_STATUSES },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
    });
    if (conflict) {
      throw new ConflictException(
        'Room is already booked for the selected dates.',
      );
    }
  }

  async list(
    caller: AuthenticatedUser,
    hotelId: string,
    query: ListReservationsQueryDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where = {
      hotelId,
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.guestId ? { guestId: query.guestId } : {}),
      ...(query.from && query.to
        ? {
            checkInDate: { lt: new Date(query.to) },
            checkOutDate: { gt: new Date(query.from) },
          }
        : {}),
    };

    const [total, reservations] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        orderBy: { checkInDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: this.includeShape,
      }),
    ]);

    return {
      data: reservations.map((r) => this.shape(r)),
      meta: { page, limit, total },
    };
  }

  async getOne(caller: AuthenticatedUser, hotelId: string, reservationId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const reservation = await this.resolveReservation(tenantId, hotelId, reservationId);
    return this.shape(reservation);
  }

  async create(
    caller: AuthenticatedUser,
    hotelId: string,
    dto: CreateReservationDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    await this.guestsService.resolveGuest(tenantId, hotelId, dto.guestId);
    await this.roomsService.resolveRoom(tenantId, hotelId, dto.roomId);

    const { checkIn, checkOut } = this.parseDateRange(dto.checkInDate, dto.checkOutDate);
    await this.assertAvailable(tenantId, hotelId, dto.roomId, checkIn, checkOut);

    const reservation = await this.prisma.reservation.create({
      data: {
        tenantId,
        hotelId,
        guestId: dto.guestId,
        roomId: dto.roomId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: dto.adults ?? 1,
        children: dto.children ?? 0,
        notes: dto.notes,
      },
      include: this.includeShape,
    });
    return this.shape(reservation);
  }

  /**
   * Updates booking fields (guest, room, dates, occupancy, notes) and/or
   * transitions status. Field changes are rejected once a reservation has
   * reached a terminal state (CANCELLED/COMPLETED) - use a new reservation
   * instead. Status transitions go through `applyStatusTransition`, which
   * enforces ALLOWED_TRANSITIONS regardless of what else is in the payload.
   */
  async update(
    caller: AuthenticatedUser,
    hotelId: string,
    reservationId: string,
    dto: UpdateReservationDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const existing = await this.resolveReservation(tenantId, hotelId, reservationId);

    const isFieldUpdate =
      dto.guestId !== undefined ||
      dto.roomId !== undefined ||
      dto.checkInDate !== undefined ||
      dto.checkOutDate !== undefined ||
      dto.adults !== undefined ||
      dto.children !== undefined ||
      dto.notes !== undefined;

    if (isFieldUpdate && ['CANCELLED', 'COMPLETED'].includes(existing.status)) {
      throw new ConflictException(
        `Cannot modify a reservation that is already ${existing.status.toLowerCase()}.`,
      );
    }

    const nextGuestId = dto.guestId ?? existing.guestId;
    const nextRoomId = dto.roomId ?? existing.roomId;
    const nextCheckIn = dto.checkInDate ? new Date(dto.checkInDate) : existing.checkInDate;
    const nextCheckOut = dto.checkOutDate ? new Date(dto.checkOutDate) : existing.checkOutDate;

    if (isFieldUpdate) {
      if (nextCheckOut <= nextCheckIn) {
        throw new BadRequestException('checkOutDate must be after checkInDate.');
      }
      if (dto.guestId) {
        await this.guestsService.resolveGuest(tenantId, hotelId, dto.guestId);
      }
      if (dto.roomId) {
        await this.roomsService.resolveRoom(tenantId, hotelId, dto.roomId);
      }
      if (dto.roomId || dto.checkInDate || dto.checkOutDate) {
        await this.assertAvailable(
          tenantId,
          hotelId,
          nextRoomId,
          nextCheckIn,
          nextCheckOut,
          reservationId,
        );
      }
    }

    let targetStatus = existing.status;
    if (dto.status && dto.status !== existing.status) {
      targetStatus = this.applyStatusTransition(existing.status, dto.status);
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        guestId: nextGuestId,
        roomId: nextRoomId,
        checkInDate: nextCheckIn,
        checkOutDate: nextCheckOut,
        adults: dto.adults ?? existing.adults,
        children: dto.children ?? existing.children,
        notes: dto.notes ?? existing.notes,
        status: targetStatus,
      },
      include: this.includeShape,
    });
    return this.shape(updated);
  }

  /** Dedicated cancel action - sets status to CANCELLED via the same transition guard. */
  async cancel(caller: AuthenticatedUser, hotelId: string, reservationId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const existing = await this.resolveReservation(tenantId, hotelId, reservationId);
    const status = this.applyStatusTransition(existing.status, 'CANCELLED');
    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status },
      include: this.includeShape,
    });
    return this.shape(updated);
  }

  /**
   * Phase 5: transitions a reservation CONFIRMED -> COMPLETED as part of
   * a front-desk check-out. Internal-use method for FrontDeskModule
   * only (not exposed on the controller — check-out is the only path
   * that should ever produce this transition; a bare PATCH .../status
   * to COMPLETED without a Stay would skip the realized-occupancy
   * record entirely). Goes through the same `applyStatusTransition`
   * guard as every other status write, so an already-terminal or
   * still-PENDING reservation is rejected the same way it would be
   * anywhere else. Accepts an optional transaction client so
   * FrontDeskService can include this write in its atomic check-out
   * transaction alongside the Stay and Room updates.
   */
  async completeFromStay(
    tenantId: string,
    hotelId: string,
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.reservation.findFirst({
      where: { id: reservationId, hotelId, tenantId },
    });
    if (!existing) throw new NotFoundException('Reservation not found.');
    const status = this.applyStatusTransition(existing.status, 'COMPLETED');
    await client.reservation.update({
      where: { id: reservationId },
      data: { status },
    });
  }

  /**
   * Phase 5: reservations confirmed and due (or overdue) to arrive, that
   * have not yet been checked in — the "Arrivals" list on the front-desk
   * dashboard. `stay: null` filters on Reservation's own relation to its
   * (at most one) Stay; this is still a query over Reservation's own
   * data, not a read of Stay's content, so it doesn't cross the
   * module-boundary rule in /docs/MODULE-ARCHITECTURE.md the way owning
   * or writing Stay data from here would.
   */
  async listArrivals(caller: AuthenticatedUser, hotelId: string, onOrBefore: Date) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        tenantId,
        hotelId,
        status: 'CONFIRMED',
        checkInDate: { lte: onOrBefore },
        stay: null,
      },
      orderBy: { checkInDate: 'asc' },
      include: this.includeShape,
    });
    return reservations.map((r) => this.shape(r));
  }

  private applyStatusTransition(
    current: ReservationStatus,
    target: ReservationStatus,
  ): ReservationStatus {
    const allowed = ALLOWED_TRANSITIONS[current];
    if (!allowed.includes(target)) {
      throw new ConflictException(
        `Cannot transition reservation from ${current} to ${target}.`,
      );
    }
    return target;
  }

  private readonly includeShape = {
    guest: { select: { id: true, firstName: true, lastName: true, email: true } },
    room: {
      select: {
        id: true,
        number: true,
        floor: true,
        roomType: { select: { id: true, name: true } },
      },
    },
  };

  private shape(
    r: Reservation & {
      guest: { id: string; firstName: string; lastName: string; email: string | null };
      room: {
        id: string;
        number: string;
        floor: number | null;
        roomType: { id: string; name: string };
      };
    },
  ) {
    return {
      id: r.id,
      status: r.status,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      adults: r.adults,
      children: r.children,
      notes: r.notes,
      guest: r.guest,
      room: {
        id: r.room.id,
        number: r.room.number,
        floor: r.room.floor,
        roomType: r.room.roomType,
      },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
