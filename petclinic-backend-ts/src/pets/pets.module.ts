import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './pet.entity';
import { PetType } from '../pet-types/pet-type.entity';
import { Visit } from '../visits/visit.entity';
import { Owner } from '../owners/owner.entity';
import { PetController } from './pet.controller';

/**
 * Pets feature module — ported from the Spring Boot Pet domain.
 *
 * Registers the entities touched by the Pet controller/mapper so the TypeORM
 * repositories can be injected directly (no service layer, mirroring Java).
 * Mappers are stateless functions and are NOT providers.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Pet, PetType, Visit, Owner])],
  controllers: [PetController],
})
export class PetsModule {}
