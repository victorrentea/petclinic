import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Visit = Omit<components['schemas']['VisitDto'], 'date' | 'petId'> & {
  date: string;
  petId?: number;
  pet: Pet;
};

/**
 * How a visit's vet reads on screen. A visit nobody has been assigned to says so — the
 * cell is never left blank, which a reader can only take for a bug.
 */
export function vetLabel(visit: Visit): string {
  const name = [visit.vetFirstName, visit.vetLastName].filter(part => !!part).join(' ');
  return name || 'none';
}
