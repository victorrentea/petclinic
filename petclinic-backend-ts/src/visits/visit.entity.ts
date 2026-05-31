import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pet } from '../pets/pet.entity';

/**
 * Ported from victor.training.petclinic.model.Visit.
 * @Table(name = "visits")
 *
 * Java `LocalDate date = LocalDate.now()` -> TS `string` ('YYYY-MM-DD') backed by
 * a TypeORM 'date' column. The default-to-today behaviour is reproduced via
 * `Visit.create()` / `ensureDate()` (TypeORM cannot run a Java-style field
 * initializer). See CONVENTIONS.md "Dates".
 */
@Entity({ name: 'visits' })
export class Visit {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  /** Java LocalDate -> ISO 'YYYY-MM-DD' string, stored in a DATE column. */
  @Column({ name: 'visit_date', type: 'date', nullable: true })
  date?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => Pet, (pet) => pet.visits)
  @JoinColumn({ name: 'pet_id' })
  pet?: Pet;

  /**
   * Mirrors the Java field initializer `LocalDate date = LocalDate.now()`:
   * a freshly-created Visit defaults its date to today when none is supplied.
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
