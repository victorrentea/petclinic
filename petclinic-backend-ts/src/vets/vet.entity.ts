import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Specialty } from '../specialties/specialty.entity';
import { Visit } from '../visits/visit.entity';

/**
 * Vet entity, mapped to the "vets" table.
 *
 * Vet <-> Specialty is a many-to-many via the 'vet_specialties' join table
 * (joinColumn vet_id, inverseJoinColumn specialty_id, unique (vet_id, specialty_id)).
 */
@Entity({ name: 'vets' })
export class Vet {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName?: string;

  @ManyToMany(() => Specialty)
  @JoinTable({
    name: 'vet_specialties',
    joinColumn: { name: 'vet_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'specialty_id', referencedColumnName: 'id' },
  })
  specialties!: Specialty[];

  /** Inverse side of Visit.vet — the visits this vet served. */
  @OneToMany(() => Visit, (visit) => visit.vet)
  visits?: Visit[];

  /** Removes all of this vet's specialties. */
  clearSpecialties(): void {
    this.specialties = [];
  }

  /** Returns the number of specialties this vet has. */
  getNrOfSpecialties(): number {
    return (this.specialties ?? []).length;
  }

  /** Adds a specialty to this vet. */
  addSpecialty(specialty: Specialty): void {
    (this.specialties ??= []).push(specialty);
  }
}
