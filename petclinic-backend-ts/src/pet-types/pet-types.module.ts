import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PetType } from './pet-type.entity';
import { PetTypeController } from './pet-type.controller';

/**
 * Pet types feature module. Registers the PetType entity for this scope and
 * exposes the controller. The root app.module.ts (Integration phase) imports it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PetType])],
  controllers: [PetTypeController],
})
export class PetTypesModule {}
