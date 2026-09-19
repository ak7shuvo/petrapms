import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

/**
 * Room Management service — tenant context always from AuthenticatedUser.
 * Every query includes both tenantId and hotelId guards to ensure strict
 * tenant isolation (see /docs/MULTI-TENANCY.md).
 */
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped room data.',
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

  // ─── Room Types ────────────────────────────────────────────────────────────

  async listRoomTypes(caller: AuthenticatedUser, hotelId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const types = await this.prisma.roomType.findMany({
      where: { hotelId, tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { rooms: true } } },
    });
    return types.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      baseRate: Number(t.baseRate),
      maxOccupancy: t.maxOccupancy,
      roomCount: t._count.rooms,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async createRoomType(
    caller: AuthenticatedUser,
    hotelId: string,
    dto: CreateRoomTypeDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    try {
      const rt = await this.prisma.roomType.create({
        data: { tenantId, hotelId, ...dto },
      });
      return this.shapeRoomType(rt);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(`Room type "${dto.name}" already exists in this hotel.`);
      }
      throw e;
    }
  }

  async updateRoomType(
    caller: AuthenticatedUser,
    hotelId: string,
    roomTypeId: string,
    dto: UpdateRoomTypeDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const existing = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, hotelId, tenantId },
    });
    if (!existing) throw new NotFoundException('Room type not found.');
    try {
      const rt = await this.prisma.roomType.update({
        where: { id: roomTypeId },
        data: dto,
      });
      return this.shapeRoomType(rt);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(`Room type "${dto.name}" already exists in this hotel.`);
      }
      throw e;
    }
  }

  async deleteRoomType(
    caller: AuthenticatedUser,
    hotelId: string,
    roomTypeId: string,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const existing = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, hotelId, tenantId },
    });
    if (!existing) throw new NotFoundException('Room type not found.');
    const roomCount = await this.prisma.room.count({ where: { roomTypeId } });
    if (roomCount > 0) {
      throw new ConflictException(
        'Cannot delete a room type that has rooms. Remove all rooms first.',
      );
    }
    await this.prisma.roomType.delete({ where: { id: roomTypeId } });
  }

  /**
   * Resolves a single room scoped to this tenant + hotel. Exposed (beyond
   * the CRUD methods below) for reuse by ReservationsService, which must
   * verify a roomId belongs to the same hotel/tenant before booking it —
   * per /docs/MODULE-ARCHITECTURE.md, other modules access Room Management
   * data only through this service, never by querying the `rooms` table
   * directly.
   */
  async resolveRoom(tenantId: string, hotelId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId, tenantId },
    });
    if (!room) throw new NotFoundException('Room not found in this hotel.');
    return room;
  }

  /**
   * Phase 5: sets a room's operational status without going through the
   * general-purpose `updateRoom` (which is reserved for client-facing
   * room-profile edits guarded by `rooms.manage`). Used internally by
   * FrontDeskModule when a check-in/check-out changes physical occupancy
   * — per /docs/MODULE-ARCHITECTURE.md, FrontDeskModule still goes
   * through RoomsService rather than writing to the `rooms` table itself.
   * Accepts an optional transaction client so callers can include this
   * write in an atomic check-in/check-out transaction.
   */
  async setOperationalStatus(
    tenantId: string,
    hotelId: string,
    roomId: string,
    status: RoomStatus,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    await client.room.update({
      where: { id: roomId },
      data: { status },
    });
  }

  /**
   * Counts reservations referencing a room. Used by deleteRoom below to
   * block deletion of a room with existing bookings, mirroring the
   * roomType-has-rooms guard already in deleteRoomType.
   */
  private async countReservationsForRoom(roomId: string): Promise<number> {
    return this.prisma.reservation.count({ where: { roomId } });
  }

  // ─── Rooms ─────────────────────────────────────────────────────────────────

  async listRooms(caller: AuthenticatedUser, hotelId: string) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const rooms = await this.prisma.room.findMany({
      where: { hotelId, tenantId },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      include: { roomType: { select: { id: true, name: true, baseRate: true } } },
    });
    return rooms.map((r) => this.shapeRoom(r));
  }

  async createRoom(
    caller: AuthenticatedUser,
    hotelId: string,
    dto: CreateRoomDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    // Verify roomType belongs to this hotel + tenant
    const rt = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, hotelId, tenantId },
    });
    if (!rt) throw new NotFoundException('Room type not found in this hotel.');
    try {
      const room = await this.prisma.room.create({
        data: { tenantId, hotelId, ...dto },
        include: { roomType: { select: { id: true, name: true, baseRate: true } } },
      });
      return this.shapeRoom(room);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(`Room number "${dto.number}" already exists in this hotel.`);
      }
      throw e;
    }
  }

  async updateRoom(
    caller: AuthenticatedUser,
    hotelId: string,
    roomId: string,
    dto: UpdateRoomDto,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const existing = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId, tenantId },
    });
    if (!existing) throw new NotFoundException('Room not found.');
    // If roomTypeId is being changed, verify the new type belongs here
    if (dto.roomTypeId && dto.roomTypeId !== existing.roomTypeId) {
      const rt = await this.prisma.roomType.findFirst({
        where: { id: dto.roomTypeId, hotelId, tenantId },
      });
      if (!rt) throw new NotFoundException('Room type not found in this hotel.');
    }
    try {
      const room = await this.prisma.room.update({
        where: { id: roomId },
        data: dto,
        include: { roomType: { select: { id: true, name: true, baseRate: true } } },
      });
      return this.shapeRoom(room);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(`Room number "${dto.number}" already exists in this hotel.`);
      }
      throw e;
    }
  }

  async deleteRoom(
    caller: AuthenticatedUser,
    hotelId: string,
    roomId: string,
  ) {
    const tenantId = this.requireTenant(caller);
    await this.resolveHotel(tenantId, hotelId);
    const existing = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId, tenantId },
    });
    if (!existing) throw new NotFoundException('Room not found.');
    // Phase 4: a room referenced by a reservation cannot be deleted — the
    // FK is onDelete: Restrict at the database level too, but this gives
    // a clear 409 instead of a raw constraint error (mirrors the
    // roomType-has-rooms guard above).
    const reservationCount = await this.countReservationsForRoom(roomId);
    if (reservationCount > 0) {
      throw new ConflictException(
        'Cannot delete a room that has reservations.',
      );
    }
    await this.prisma.room.delete({ where: { id: roomId } });
  }

  private shapeRoomType(rt: {
    id: string; name: string; description: string | null;
    baseRate: any; maxOccupancy: number; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: rt.id,
      name: rt.name,
      description: rt.description,
      baseRate: Number(rt.baseRate),
      maxOccupancy: rt.maxOccupancy,
      createdAt: rt.createdAt,
      updatedAt: rt.updatedAt,
    };
  }

  private shapeRoom(r: {
    id: string; number: string; floor: number | null; status: string;
    notes: string | null; createdAt: Date; updatedAt: Date;
    roomType: { id: string; name: string; baseRate: any };
  }) {
    return {
      id: r.id,
      number: r.number,
      floor: r.floor,
      status: r.status,
      notes: r.notes,
      roomType: {
        id: r.roomType.id,
        name: r.roomType.name,
        baseRate: Number(r.roomType.baseRate),
      },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
