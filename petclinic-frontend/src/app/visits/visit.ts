import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Visit = Omit<components['schemas']['VisitDto'], 'date' | 'petId'> & {
  date: string;
  petId?: number;
  pet: Pet;
};
