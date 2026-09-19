import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Stay, StayStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { RoomsService } from '../hotels/rooms.service';
import { ReservationsService } from '../reservations/reservations.service';
import { CheckInDto } from './dto/check-in.dto';
import { ListStaysQueryDto } from './dto/list-stays-query.dto';

/**
 * Front Desk — check-in/check-out and day-to-day stay management,
 * building on Reservation and Room Management (see
 * /docs/MODULE-ARCHITECTURE.md). Owns the Stay entity: the realized-
 * occupancy record kept distinct from Reservation's booking intent
 * (see /docs/DATABASE-ARCHITECTURE.md).
 *
 * Every write here (Stay, Room status, Reservation status) happens
 * inside a single Prisma transaction so a check-in or check-out can
 * never leave the system in a half-updated state (Stay created but
 * room still AVAILABLE, or vice versa).
 */
@Injectable()
export class FrontDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly reservationsService: ReservationsService,
  ) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped front-desk data.',
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

  private async resolveStay(tenantId: string, hotelId: string, stayId: string) {
    const stay = await this.prisma.stay.findFirst({
      where: { id: stayId, hotelId, tenantId },
      include: this.includeShape,
    });
    if (!stay) throw new NotFoundException('Stay not found.');
    return stay;
  }

  /** Start of the current UTC day, matching how checkInDate/checkOutDate (`@db.Date`) are stored. */
  private today(): Date {
    return new Date(new Date().toISOString().slice(0, 10));
  }

  // ─── Check-in / check-out ───────────────────────────────────────────────

  /**
   * Check-in: CONFIRMED reservation -> Stay created (ACTIVE), room ->
   * OCCUPIED. Reservation itself stays CONFIRMED throughout the stay;
   * it only becomes COMPLETED at check-out (see checkOut below) — see
   * /docs/DEVELOPMENT-PHASES.md, Phase 5 scope.
   */
  async checkIn(caller: AuthenticatedUser, hotelId: string, dto: CheckInDto) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);

    const reservation = await this.reservationsService.resolveReservation(
      tenantId,
      hotelId,
      dto.reservationId,
    );

    if (reservation.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Only confirmed reservations can be checked in (this one is ${reservation.status}).`,
      );
    }

    // resolveReservation's include shape doesn't carry room.status, so
    // look the room up fresh through RoomsService (never the raw table —
    // see /docs/MODULE-ARCHITECTURE.md).
    const room = await this.roomsService.resolveRoom(
      tenantId,
      hotelId,
      reservation.room.id,
    );
    if (room.status === 'OCCUPIED') {
      throw new ConflictException(
        'Room is currently occupied by another active stay. Check that guest out first.',
      );
    }

    const stay = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stay.create({
        data: {
          tenantId,
          hotelId,
          reservationId: reservation.id,
          guestId: reservation.guest.id,
          roomId: reservation.room.id,
          notes: dto.notes,
        },
        include: this.includeShape,
      });
      await this.roomsService.setOperationalStatus(
        tenantId,
        hotelId,
        reservation.room.id,
        'OCCUPIED',
        tx,
      );
      return created;
    });

    return this.shape(stay);
  }

  /**
   * Check-out: closes the Stay (-> COMPLETED, checkOutAt set), room ->
   * AVAILABLE, reservation -> COMPLETED.
   */
  async checkOut(caller: AuthenticatedUser, hotelId: string, stayId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const existing = await this.resolveStay(tenantId, hotelId, stayId);

    if (existing.status !== 'ACTIVE') {
      throw new ConflictException('This stay has already been checked out.');
    }

    const stay = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.stay.update({
        where: { id: stayId },
        data: { status: 'COMPLETED', checkOutAt: new Date() },
        include: this.includeShape,
      });
      await this.roomsService.setOperationalStatus(
        tenantId,
        hotelId,
        existing.roomId,
        'AVAILABLE',
        tx,
      );
      await this.reservationsService.completeFromStay(
        tenantId,
        hotelId,
        existing.reservationId,
        tx,
      );
      return updated;
    });

    return this.shape(stay);
  }

  // ─── Reads ───────────────────────────────────────────────────────────────

  async list(caller: AuthenticatedUser, hotelId: string, query: ListStaysQueryDto) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const stays = await this.prisma.stay.findMany({
      where: { hotelId, tenantId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { checkInAt: 'desc' },
      include: this.includeShape,
    });
    return stays.map((s) => this.shape(s));
  }

  async getOne(caller: AuthenticatedUser, hotelId: string, stayId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const stay = await this.resolveStay(tenantId, hotelId, stayId);
    return this.shape(stay);
  }

  /** Confirmed reservations due (or overdue) to check in, not yet checked in. */
  async arrivals(caller: AuthenticatedUser, hotelId: string) {
    return this.reservationsService.listArrivals(caller, hotelId, this.today());
  }

  /**
   * Active stays whose reservation is due (or overdue) to check out
   * today. Stay is this module's own table; filtering it by its 1:1
   * reservation's checkOutDate is a read-only join, the same pattern
   * ReservationsService already uses to shape guest/room onto a
   * reservation (see reservations.service.ts — `includeShape`).
   */
  async departures(caller: AuthenticatedUser, hotelId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const stays = await this.prisma.stay.findMany({
      where: {
        tenantId,
        hotelId,
        status: 'ACTIVE',
        reservation: { checkOutDate: { lte: this.today() } },
      },
      orderBy: { checkInAt: 'asc' },
      include: this.includeShape,
    });
    return stays.map((s) => this.shape(s));
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
    reservation: {
      select: { id: true, checkInDate: true, checkOutDate: true, status: true },
    },
  };

  private shape(
    s: Stay & {
      guest: { id: string; firstName: string; lastName: string; email: string | null };
      room: {
        id: string;
        number: string;
        floor: number | null;
        roomType: { id: string; name: string };
      };
      reservation: {
        id: string;
        checkInDate: Date;
        checkOutDate: Date;
        status: string;
      };
    },
  ) {
    return {
      id: s.id,
      status: s.status as StayStatus,
      checkInAt: s.checkInAt,
      checkOutAt: s.checkOutAt,
      notes: s.notes,
      guest: s.guest,
      room: {
        id: s.room.id,
        number: s.room.number,
        floor: s.room.floor,
        roomType: s.room.roomType,
      },
      reservation: s.reservation,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
