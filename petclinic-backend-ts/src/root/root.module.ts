import { Module } from '@nestjs/common';
import { RootController } from './root.controller';

/**
 * Mirrors the Java RootRestController wiring: exposes "/" that redirects to
 * the Swagger UI. No repositories/entities — pure routing.
 */
@Module({
  controllers: [RootController],
})
export class RootModule {}
