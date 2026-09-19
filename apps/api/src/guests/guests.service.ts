import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { ListGuestsQueryDto } from './dto/list-guests-query.dto';

/**
 * Guest Management service — tenant context always from AuthenticatedUser,
 * mirroring the RoomsService pattern (see /docs/MULTI-TENANCY.md). Every
 * query includes both tenantId and hotelId guards.
 */
@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped guest data.',
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
   * Resolves a guest scoped to this tenant + hotel. Exposed for reuse by
   * ReservationsService, which must verify a guestId belongs to the same
   * hotel/tenant before linking it to a reservation.
   */
  async resolveGuest(tenantId: string, hotelId: string, guestId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, hotelId, tenantId },
    });
    if (!guest) throw new NotFoundException('Guest not found in this hotel.');
    return guest;
  }

  async list(
    caller: AuthenticatedUser,
    hotelId: string,
    query: ListGuestsQueryDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = {
      hotelId,
      tenantId,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, guests] = await this.prisma.$transaction([
      this.prisma.guest.count({ where }),
      this.prisma.guest.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: guests.map((g) => this.shape(g)),
      meta: { page, limit, total },
    };
  }

  async getOne(caller: AuthenticatedUser, hotelId: string, guestId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const guest = await this.resolveGuest(tenantId, hotelId, guestId);
    return this.shape(guest);
  }

  async create(caller: AuthenticatedUser, hotelId: string, dto: CreateGuestDto) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const guest = await this.prisma.guest.create({
      data: { tenantId, hotelId, ...dto },
    });
    return this.shape(guest);
  }

  async update(
    caller: AuthenticatedUser,
    hotelId: string,
    guestId: string,
    dto: UpdateGuestDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    await this.resolveGuest(tenantId, hotelId, guestId);
    const guest = await this.prisma.guest.update({
      where: { id: guestId },
      data: dto,
    });
    return this.shape(guest);
  }

  async delete(caller: AuthenticatedUser, hotelId: string, guestId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    await this.resolveGuest(tenantId, hotelId, guestId);
    const reservationCount = await this.prisma.reservation.count({
      where: { guestId },
    });
    if (reservationCount > 0) {
      throw new ConflictException(
        'Cannot delete a guest with existing reservations.',
      );
    }
    await this.prisma.guest.delete({ where: { id: guestId } });
  }

  private shape(g: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    nationality: string | null;
    documentNumber: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      phone: g.phone,
      address: g.address,
      nationality: g.nationality,
      documentNumber: g.documentNumber,
      notes: g.notes,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }
}
