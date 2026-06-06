import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * PetType entity, mapped to the "types" table.
 */
@Entity({ name: 'types' })
export class PetType {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ type: 'text', nullable: true })
  name?: string;
}
