import {Specialty} from '../specialties/specialty';

export interface Vet {
  id: number;
  firstName: string;
  lastName: string;
  specialties: Specialty[];
}
