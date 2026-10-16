import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Owner = Omit<components['schemas']['OwnerDto'], 'id' | 'pets'> & {
  id: number;
  pets: Pet[];
};

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

/** One page of the owners grid, as `GET /api/owners` takes it: page is 0-based, sort is `<key>,<dir>`. */
export interface OwnerQuery {
  page: number;
  size: number;
  sort: string;
  lastName?: string;
}
