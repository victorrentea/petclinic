import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PetType } from '../pet-types/pet-type.entity';
import { Owner } from '../owners/owner.entity';
import { Visit } from '../visits/visit.entity';

/**
 * Ported from victor.training.petclinic.model.Pet.
 * @Table(name = "pets")
 */
@Entity({ name: 'pets' })
export class Pet {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ type: 'text', nullable: true })
  name?: string;

  /** Java LocalDate -> ISO 'YYYY-MM-DD' string, stored in a DATE column. */
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: string;

  @ManyToOne(() => PetType)
  @JoinColumn({ name: 'type_id' })
  type?: PetType;

  @ManyToOne(() => Owner, (owner) => owner.pets)
  @JoinColumn({ name: 'owner_id' })
  owner?: Owner;

  // Java: @OneToMany(cascade = ALL, mappedBy = "pet", fetch = LAZY)
  @OneToMany(() => Visit, (visit) => visit.pet, { cascade: true })
  visits!: Visit[];

  /**
   * Mirrors Java Pet.getVisitsSortedByDate():
   * visits sorted by date DESCENDING (ascending=false).
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

  /** Mirrors Java Pet.addVisit(): adds the visit and back-links it to this pet. */
  addVisit(visit: Visit): void {
    (this.visits ??= []).push(visit);
    visit.pet = this;
  }
}
