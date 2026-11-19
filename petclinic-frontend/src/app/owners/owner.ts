import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Owner = Omit<components['schemas']['OwnerDto'], 'id' | 'pets'> & {
  id: number;
  pets: Pet[];
};

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export type OwnerSort = 'name,asc' | 'name,desc' | 'city,asc' | 'city,desc';

export interface OwnerQuery {
  lastName: string;
  page: number;
  size: number;
  sort: OwnerSort;
}
