import { Module } from '@nestjs/common';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

/**
 * Hotel Management + Room Management module.
 * Owns: Hotel, RoomType, Room entities.
 * Per /docs/MODULE-ARCHITECTURE.md — Hotel Management and Room Management
 * are distinct conceptual modules; they share this NestJS module for
 * Phase 3 simplicity and can be split later if needed.
 */
@Module({
  controllers: [HotelsController, RoomsController],
  providers: [HotelsService, RoomsService],
  exports: [HotelsService, RoomsService],
})
export class HotelsModule {}
