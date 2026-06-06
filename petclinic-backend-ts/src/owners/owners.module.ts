import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Owner } from './owner.entity';
import { Pet } from '../pets/pet.entity';
import { Visit } from '../visits/visit.entity';
import { PetType } from '../pets/pet-type.entity';
import { OwnerController } from './owner.controller';

/**
 * Feature module for the owners domain.
 *
 * The controller injects the Owner, Pet, Visit and PetType repositories
 * directly (no service layer), so the module only needs to register those
 * entities via TypeOrmModule.forFeature.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Owner, Pet, Visit, PetType])],
  controllers: [OwnerController],
})
export class OwnersModule {}
