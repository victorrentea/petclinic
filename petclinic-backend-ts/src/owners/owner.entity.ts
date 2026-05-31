import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Pet } from '../pets/pet.entity';

/**
 * Owner entity, mapped to the "owners" table.
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

  @OneToMany(() => Pet, (pet) => pet.owner, { cascade: true })
  pets!: Pet[];

  /**
   * Returns this owner's pets sorted by name ASCENDING (case-insensitive).
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

  /** Adds the pet and back-links it to this owner. */
  addPet(pet: Pet): void {
    (this.pets ??= []).push(pet);
    pet.owner = this;
  }

  /** Finds an owned pet by id, if present. */
  getPetById(petId: number): Pet | undefined {
    return (this.pets ?? []).find((p) => p.id === petId);
  }
}
