import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Owner = Omit<components['schemas']['OwnerDto'], 'id' | 'pets'> & {
  id: number;
  pets: Pet[];
};

/** A row of the paginated owners list - the slim shape returned by `GET /api/owners`. */
export type OwnerListItem = Required<components['schemas']['OwnerListItemDto']>;
