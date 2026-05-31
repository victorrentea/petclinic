import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Specialty entity, mapped to the "specialties" table.
 */
@Entity({ name: 'specialties' })
export class Specialty {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ type: 'text', nullable: true })
  name?: string;
}
