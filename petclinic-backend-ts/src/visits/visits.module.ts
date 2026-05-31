import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visit } from './visit.entity';
import { Pet } from '../pets/pet.entity';
import { Owner } from '../owners/owner.entity';
import { VisitController } from './visit.controller';

/**
 * Feature module for the Visits domain.
 *
 * Registers Visit (plus Pet + Owner, traversed by the relations in
 * VisitController) with TypeORM. The VisitController is exported so the MCP
 * layer can reuse `findByPetId`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Visit, Pet, Owner])],
  controllers: [VisitController],
  providers: [VisitController],
  exports: [VisitController],
})
export class VisitsModule {}
