import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';

/**
 * Hotel Management service — follows the UsersService pattern:
 * tenant context comes only from the AuthenticatedUser, never from
 * route/body params (see /docs/MULTI-TENANCY.md).
 */
@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(caller: AuthenticatedUser): string {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not operate on tenant-scoped hotel data.',
      );
    }
    return caller.tenantId;
  }

  async getHotel(caller: AuthenticatedUser) {
    const tenantId = this.requireTenant(caller);
    const hotel = await this.prisma.hotel.findFirst({
      where: { tenantId },
    });
    if (!hotel) throw new NotFoundException('No hotel configured for this tenant.');
    return this.shape(hotel);
  }

  async upsertHotel(caller: AuthenticatedUser, dto: CreateHotelDto | UpdateHotelDto) {
    const tenantId = this.requireTenant(caller);
    const existing = await this.prisma.hotel.findFirst({ where: { tenantId } });

    if (existing) {
      const updated = await this.prisma.hotel.update({
        where: { id: existing.id },
        data: dto,
      });
      return this.shape(updated);
    }

    const created = await this.prisma.hotel.create({
      data: { tenantId, ...(dto as CreateHotelDto) },
    });
    return this.shape(created);
  }

  private shape(hotel: {
    id: string; tenantId: string; name: string; address: string | null;
    city: string | null; country: string | null; phone: string | null;
    email: string | null; description: string | null;
    createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: hotel.id,
      tenantId: hotel.tenantId,
      name: hotel.name,
      address: hotel.address,
      city: hotel.city,
      country: hotel.country,
      phone: hotel.phone,
      email: hotel.email,
      description: hotel.description,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    };
  }
}
