import {Pet} from '../pets/pet';

export interface Owner {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  pets: Pet[];
}

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;  // 0-based page index (Spring's field name)
  size: number;
}
