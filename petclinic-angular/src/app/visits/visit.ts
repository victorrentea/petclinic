import {Pet} from '../pets/pet';

export interface Visit {
  id: number;
  date: string;
  description: string;
  pet: Pet;
  petId?: number;
}
