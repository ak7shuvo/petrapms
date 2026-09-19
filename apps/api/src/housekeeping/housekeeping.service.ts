import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { UpdateHousekeepingStatusDto } from './dto/update-housekeeping-status.dto';

/**
 * Housekeeping module — tracks room readiness (HousekeepingStatus),
 * distinct from Room.status (occupancy). Consumed by Front Desk in a
 * later phase for room assignment (see MODULE-ARCHITECTURE.md).
 *
 * Follows the same tenant-context pattern as RoomsService: tenantId
 * always comes from AuthenticatedUser, and every query is additionally
 * scoped by hotelId via resolveHotel (see MULTI-TENANCY.md).
 */
@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped housekeeping data.',
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

  /**
   * Returns housekeeping status for every room in the hotel, ordered like
   * the room list (floor, then number). Rooms created in Phase 3 (before
   * this module existed) have no HousekeepingStatus row yet — those are
   * backfilled lazily here with the DIRTY default, rather than requiring
   * a separate migration step, so the board is always complete.
   */
  async listForHotel(caller: AuthenticatedUser, hotelId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);

    const rooms = await this.prisma.room.findMany({
      where: { hotelId, tenantId },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      include: {
        roomType: { select: { id: true, name: true } },
        housekeeping: true,
      },
    });

    // Backfill any rooms missing a HousekeepingStatus row.
    const missing = rooms.filter((r) => !r.housekeeping);
    if (missing.length > 0) {
      await this.prisma.$transaction(
        missing.map((r) =>
          this.prisma.housekeepingStatus.upsert({
            where: { roomId: r.id },
            create: { tenantId, hotelId, roomId: r.id },
            update: {},
          }),
        ),
      );
      // Re-fetch so freshly-created rows are included in the response.
      const refreshedRooms = await this.prisma.room.findMany({
        where: { hotelId, tenantId },
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        include: {
          roomType: { select: { id: true, name: true } },
          housekeeping: true,
        },
      });

      return refreshedRooms.map((r) => ({
        roomId: r.id,
        roomNumber: r.number,
        floor: r.floor,
        roomType: r.roomType.name,
        status: r.housekeeping!.status,
        notes: r.housekeeping!.notes,
        updatedAt: r.housekeeping!.updatedAt,
      }));
    }

    return rooms.map((r) => ({
      roomId: r.id,
      roomNumber: r.number,
      floor: r.floor,
      roomType: r.roomType.name,
      status: r.housekeeping!.status,
      notes: r.housekeeping!.notes,
      updatedAt: r.housekeeping!.updatedAt,
    }));
  }

  /**
   * Updates (or creates, if this room has never had a housekeeping row)
   * the housekeeping status for a single room.
   */
  async updateForRoom(
    caller: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    dto: UpdateHousekeepingStatusDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId, tenantId },
    });
    if (!room) throw new NotFoundException('Room not found.');

    const updated = await this.prisma.housekeepingStatus.upsert({
      where: { roomId },
      create: {
        tenantId,
        hotelId,
        roomId,
        status: dto.status,
        notes: dto.notes,
        updatedByUserId: caller.userId,
      },
      update: {
        status: dto.status,
        notes: dto.notes,
        updatedByUserId: caller.userId,
      },
    });

    return {
      roomId: room.id,
      roomNumber: room.number,
      status: updated.status,
      notes: updated.notes,
      updatedAt: updated.updatedAt,
    };
  }
}
