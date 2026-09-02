import {Pet} from '../pets/pet';

/**
 * The window a visit may be scheduled in, shared by the add and edit forms so the
 * rule is written once. Mirrors the backend's VisitDateRange (GitHub issue #40);
 * the backend is what makes it binding, this only spares the user a round-trip.
 */
export const MAX_YEARS_AHEAD = 1;

/**
 * Undefined until the pet has loaded, which the datepicker reads as "no lower
 * bound" — the forms fetch their pet asynchronously.
 */
export function earliestVisitDate(pet: Pet | undefined): Date | undefined {
  return pet?.birthDate ? new Date(pet.birthDate) : undefined;
}

export function latestVisitDate(): Date {
  const max = new Date();
  max.setFullYear(max.getFullYear() + MAX_YEARS_AHEAD);
  return max;
}
