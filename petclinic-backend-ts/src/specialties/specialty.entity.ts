import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Ported from victor.training.petclinic.model.Specialty.
 * @Table(name = "specialties")
 */
@Entity({ name: 'specialties' })
export class Specialty {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ type: 'text', nullable: true })
  name?: string;
}
