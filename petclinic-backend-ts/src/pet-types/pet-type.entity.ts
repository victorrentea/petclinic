import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Ported from victor.training.petclinic.model.PetType.
 * @Table(name = "types")
 */
@Entity({ name: 'types' })
export class PetType {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ type: 'text', nullable: true })
  name?: string;
}
