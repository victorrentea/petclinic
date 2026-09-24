import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Owner = Omit<components['schemas']['OwnerDto'], 'id' | 'pets'> & {
  id: number;
  pets: Pet[];
};

export type OwnerRow = components['schemas']['OwnerRowDto'];
export type OwnerPage = components['schemas']['OwnerPageDto'];
