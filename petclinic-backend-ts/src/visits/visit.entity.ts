import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pet } from '../pets/pet.entity';
import { Vet } from '../vets/vet.entity';

/**
 * Visit entity, mapped to the "visits" table.
 *
 * The `date` is a `string` ('YYYY-MM-DD') backed by a TypeORM 'date' column.
 * It defaults to today when none is supplied, via `Visit.create()` /
 * `ensureDate()`. See CONVENTIONS.md "Dates".
 */
@Entity({ name: 'visits' })
export class Visit {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  /** ISO 'YYYY-MM-DD' string, stored in a DATE column. */
  @Column({ name: 'visit_date', type: 'date', nullable: true })
  date?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => Pet, (pet) => pet.visits)
  @JoinColumn({ name: 'pet_id' })
  pet?: Pet;

  /** The vet who served this visit — required (vet_id is NOT NULL). */
  @ManyToOne(() => Vet, (vet) => vet.visits, { nullable: false })
  @JoinColumn({ name: 'vet_id' })
  vet?: Vet;

  /**
   * Creates a Visit whose date defaults to today when none is supplied.
   */
  static create(): Visit {
    const visit = new Visit();
    visit.date = todayIsoDate();
    return visit;
  }

  /** Sets the date to today if it is currently unset (null/undefined/empty). */
  ensureDate(): void {
    if (!this.date) {
      this.date = todayIsoDate();
    }
  }
}

/** Returns today's date as an ISO 'YYYY-MM-DD' string (local time). */
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
