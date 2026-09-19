-- Migration: 20240901000000_initial_schema
-- Covers: Phases 2–6 full schema (Identity, Hotels, Rooms, Guests,
--         Reservations, Stays, Housekeeping).
-- Generated manually from prisma db push state; this is the first
-- committed migration — all prior schema changes were applied via db push.

-- Enums
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "StayStatus" AS ENUM ('ACTIVE', 'COMPLETED');
CREATE TYPE "HousekeepingState" AS ENUM ('DIRTY', 'IN_PROGRESS', 'CLEAN', 'INSPECTED');

-- tenants
CREATE TABLE "tenants" (
    "id"        TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "slug"      TEXT        NOT NULL,
    "status"    "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- roles
CREATE TABLE "roles" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_tenantId_name_key" ON "roles"("tenantId", "name");
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- permissions
CREATE TABLE "permissions" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- role_permissions
CREATE TABLE "role_permissions" (
    "roleId"       TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- users
CREATE TABLE "users" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT,
    "email"           TEXT NOT NULL,
    "passwordHash"    TEXT NOT NULL,
    "firstName"       TEXT NOT NULL,
    "lastName"        TEXT NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status"          "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId"          TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "tenantId"  TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- hotels
CREATE TABLE "hotels" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "address"     TEXT,
    "city"        TEXT,
    "country"     TEXT,
    "phone"       TEXT,
    "email"       TEXT,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hotels_tenantId_idx" ON "hotels"("tenantId");

-- room_types
CREATE TABLE "room_types" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "hotelId"      TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "baseRate"     DECIMAL(10,2) NOT NULL,
    "maxOccupancy" INTEGER NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "room_types_hotelId_name_key" ON "room_types"("hotelId", "name");
CREATE INDEX "room_types_tenantId_idx" ON "room_types"("tenantId");
CREATE INDEX "room_types_hotelId_idx" ON "room_types"("hotelId");

-- rooms
CREATE TABLE "rooms" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "hotelId"    TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "number"     TEXT NOT NULL,
    "floor"      INTEGER,
    "status"     "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rooms_hotelId_number_key" ON "rooms"("hotelId", "number");
CREATE INDEX "rooms_tenantId_idx" ON "rooms"("tenantId");
CREATE INDEX "rooms_hotelId_idx" ON "rooms"("hotelId");
CREATE INDEX "rooms_roomTypeId_idx" ON "rooms"("roomTypeId");

-- guests
CREATE TABLE "guests" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "hotelId"        TEXT NOT NULL,
    "firstName"      TEXT NOT NULL,
    "lastName"       TEXT NOT NULL,
    "email"          TEXT,
    "phone"          TEXT,
    "address"        TEXT,
    "nationality"    TEXT,
    "documentNumber" TEXT,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "guests_tenantId_idx" ON "guests"("tenantId");
CREATE INDEX "guests_hotelId_idx" ON "guests"("hotelId");

-- reservations
CREATE TABLE "reservations" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "hotelId"      TEXT NOT NULL,
    "guestId"      TEXT NOT NULL,
    "roomId"       TEXT NOT NULL,
    "checkInDate"  DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "status"       "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "adults"       INTEGER NOT NULL DEFAULT 1,
    "children"     INTEGER NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reservations_tenantId_idx" ON "reservations"("tenantId");
CREATE INDEX "reservations_hotelId_idx" ON "reservations"("hotelId");
CREATE INDEX "reservations_guestId_idx" ON "reservations"("guestId");
CREATE INDEX "reservations_roomId_idx" ON "reservations"("roomId");
CREATE INDEX "reservations_roomId_dates_idx" ON "reservations"("roomId", "checkInDate", "checkOutDate");

-- stays
CREATE TABLE "stays" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "hotelId"       TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "guestId"       TEXT NOT NULL,
    "roomId"        TEXT NOT NULL,
    "status"        "StayStatus" NOT NULL DEFAULT 'ACTIVE',
    "checkInAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt"    TIMESTAMP(3),
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stays_reservationId_key" ON "stays"("reservationId");
CREATE INDEX "stays_tenantId_idx" ON "stays"("tenantId");
CREATE INDEX "stays_hotelId_idx" ON "stays"("hotelId");
CREATE INDEX "stays_roomId_idx" ON "stays"("roomId");
CREATE INDEX "stays_guestId_idx" ON "stays"("guestId");
CREATE INDEX "stays_hotelId_status_idx" ON "stays"("hotelId", "status");

-- housekeeping_statuses
CREATE TABLE "housekeeping_statuses" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "hotelId"         TEXT NOT NULL,
    "roomId"          TEXT NOT NULL,
    "status"          "HousekeepingState" NOT NULL DEFAULT 'DIRTY',
    "notes"           TEXT,
    "updatedByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "housekeeping_statuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "housekeeping_statuses_roomId_key" ON "housekeeping_statuses"("roomId");
CREATE INDEX "housekeeping_statuses_tenantId_idx" ON "housekeeping_statuses"("tenantId");
CREATE INDEX "housekeeping_statuses_hotelId_idx" ON "housekeeping_statuses"("hotelId");

-- Foreign keys
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guests" ADD CONSTRAINT "guests_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stays" ADD CONSTRAINT "stays_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stays" ADD CONSTRAINT "stays_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stays" ADD CONSTRAINT "stays_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stays" ADD CONSTRAINT "stays_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_statuses" ADD CONSTRAINT "housekeeping_statuses_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
