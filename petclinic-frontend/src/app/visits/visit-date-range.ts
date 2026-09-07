import {Pet} from '../pets/pet';

// GitHub issue #40: the visit date used to be unbounded, so year 0009 was accepted.
// Shared by visit-add and visit-edit so both forms offer the same range as the API enforces.

/** The pet's birth date — a visit cannot predate the animal it is for. Null when unknown. */
export function earliestVisitDate(pet: Pet): Date | null {
  if (!pet?.birthDate) {
    return null;
  }
  return parseLocalDate(String(pet.birthDate));
}

/** One year out: anything further ahead is a typo, not a booking. */
export function latestVisitDate(): Date {
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() + 1);
  return latest;
}

/**
 * Builds the date in the browser's own zone. `new Date('2018-08-06')` is parsed as UTC
 * midnight, which lands on the previous day west of Greenwich and would shift the bound.
 */
function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}
