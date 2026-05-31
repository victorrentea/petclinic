import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Specialty } from '../specialties/specialty.entity';

/**
 * Ported from victor.training.petclinic.model.Vet.
 * @Table(name = "vets")
 *
 * Vet <-> Specialty is @ManyToMany via the 'vet_specialties' join table
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

  /** Mirrors Java Vet.clearSpecialties(). */
  clearSpecialties(): void {
    this.specialties = [];
  }

  /** Mirrors Java Vet.getNrOfSpecialties(). */
  getNrOfSpecialties(): number {
    return (this.specialties ?? []).length;
  }

  /** Mirrors Java Vet.addSpecialty(). */
  addSpecialty(specialty: Specialty): void {
    (this.specialties ??= []).push(specialty);
  }
}
