import {Pet} from '../pets/pet';

// The frontend half of issue #40, mirroring the backend's VisitDateRange:
// a visit is dated between the pet's birth and one year from today.
//
// One module for both forms (add and edit) so the two cannot drift apart, and so the
// rule is stated once on this side of the wire — the backend states it again, on purpose:
// this only spares the user a round trip, it does not enforce anything.

export const VISIT_YEARS_AHEAD = 1;

/** The earliest bookable day: the pet's birthday, or nothing when the pet has no birth date. */
export function earliestVisitDate(pet: Pet | undefined): Date | null {
  if (!pet || !pet.birthDate) {
    return null;
  }
  const born = new Date(pet.birthDate);
  return isNaN(born.getTime()) ? null : born;
}

/** The latest bookable day: one year from today. */
export function latestVisitDate(today: Date = new Date()): Date {
  const latest = new Date(today);
  latest.setFullYear(latest.getFullYear() + VISIT_YEARS_AHEAD);
  return latest;
}
