import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './pet.entity';
import { PetType } from './pet-type.entity';
import { PetTypeController } from './pet-type.controller';
import { Visit } from '../visits/visit.entity';
import { Owner } from '../owners/owner.entity';
import { PetController } from './pet.controller';

/**
 * Pets feature module.
 *
 * Registers the entities touched by the Pet controller/mapper so the TypeORM
 * repositories can be injected directly (no service layer).
 * Mappers are stateless functions and are NOT providers.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Pet, PetType, Visit, Owner])],
  controllers: [PetController, PetTypeController],
})
export class PetsModule {}
