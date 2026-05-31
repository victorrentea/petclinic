import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vet } from './vet.entity';
import { Specialty } from '../specialties/specialty.entity';
import { VetController } from './vet.controller';

/**
 * Vets feature module (ported from victor.training.petclinic VetRestController).
 *
 * Registers both Vet and Specialty so the controller can inject both
 * repositories directly (no service layer), mirroring the Java controller which
 * depends on VetRepository + SpecialtyRepository.
 *
 * Mappers are stateless functions (see vet.mapper.ts) and need no providers.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Vet, Specialty])],
  controllers: [VetController],
})
export class VetsModule {}
