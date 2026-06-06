import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PetType } from './pet-type.entity';
import { Owner } from '../owners/owner.entity';
import { Visit } from '../visits/visit.entity';

/**
 * Pet entity, mapped to the "pets" table.
 */
@Entity({ name: 'pets' })
export class Pet {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ type: 'text', nullable: true })
  name?: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: Date;

  @ManyToOne(() => PetType)
  @JoinColumn({ name: 'type_id' })
  type?: PetType;

  @ManyToOne(() => Owner, (owner) => owner.pets)
  @JoinColumn({ name: 'owner_id' })
  owner?: Owner;

  @OneToMany(() => Visit, (visit) => visit.pet, { cascade: true })
  visits!: Visit[];

  /**
   * Returns this pet's visits sorted by date DESCENDING.
   */
  getVisitsSortedByDate(): Visit[] {
    return [...(this.visits ?? [])].sort((a, b) => {
      const da = a.date ?? '';
      const db = b.date ?? '';
      // descending: later date first
      if (da < db) return 1;
      if (da > db) return -1;
      return 0;
    });
  }

  /** Adds the visit and back-links it to this pet. */
  addVisit(visit: Visit): void {
    (this.visits ??= []).push(visit);
    visit.pet = this;
  }
}
