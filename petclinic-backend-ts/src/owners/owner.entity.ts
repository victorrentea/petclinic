import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Pet } from '../pets/pet.entity';

/**
 * Ported from victor.training.petclinic.model.Owner.
 * @Table(name = "owners")
 */
@Entity({ name: 'owners' })
export class Owner {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'text', nullable: true })
  city?: string;

  @Column({ type: 'text', nullable: true })
  telephone?: string;

  // Java: @OneToMany(cascade = ALL, mappedBy = "owner", fetch = LAZY)
  @OneToMany(() => Pet, (pet) => pet.owner, { cascade: true })
  pets!: Pet[];

  /**
   * Mirrors Java Owner.getPets(): an unmodifiable view of the pets sorted by
   * name ASCENDING (case-insensitive, like Spring's PropertyComparator).
   */
  getPets(): Pet[] {
    return [...(this.pets ?? [])].sort((a, b) => {
      const na = (a.name ?? '').toLowerCase();
      const nb = (b.name ?? '').toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });
  }

  /** Mirrors Java Owner.addPet(): adds the pet and back-links it to this owner. */
  addPet(pet: Pet): void {
    (this.pets ??= []).push(pet);
    pet.owner = this;
  }

  /** Mirrors Java Owner.getPetById(): finds an owned pet by id, if present. */
  getPetById(petId: number): Pet | undefined {
    return (this.pets ?? []).find((p) => p.id === petId);
  }
}
