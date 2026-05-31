import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Specialty } from './specialty.entity';
import { SpecialtyController } from './specialty.controller';

/**
 * Specialties feature module. Registers the Specialty entity for repository
 * injection (no service layer — the controller uses the repository directly).
 * Imported by the root AppModule (owned by the Integration phase).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Specialty])],
  controllers: [SpecialtyController],
})
export class SpecialtiesModule {}
