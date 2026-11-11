import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type VisitRow = components['schemas']['VisitRowDto'];
export type VisitPage = components['schemas']['VisitPageDto'];

/** What the visits grid asks for; the backend corrects whatever it cannot serve. */
export interface VisitPageQuery {
  page?: string;
  size?: string;
  sort?: string;
}

export type Visit = Omit<components['schemas']['VisitDto'], 'date' | 'petId'> & {
  date: string;
  petId?: number;
  pet: Pet;
};
