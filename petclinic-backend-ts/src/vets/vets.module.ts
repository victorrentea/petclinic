import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vet } from './vet.entity';
import { Specialty } from '../specialties/specialty.entity';
import { VetController } from './vet.controller';

/**
 * Vets feature module.
 *
 * Registers both Vet and Specialty so the controller can inject both
 * repositories directly (no service layer).
 *
 * Mappers are stateless functions (see vet.mapper.ts) and need no providers.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Vet, Specialty])],
  controllers: [VetController],
})
export class VetsModule {}
