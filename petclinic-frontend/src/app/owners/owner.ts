import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Owner = Omit<components['schemas']['OwnerDto'], 'id' | 'pets'> & {
  id: number;
  pets: Pet[];
};

/**
 * One page of owners, over the generated envelope: the five fields the grid reads are
 * required here, and `content` carries the refined `Owner` above.
 */
export type OwnerPage = Required<
  Pick<components['schemas']['PageOwnerDto'], 'totalElements' | 'totalPages' | 'number' | 'size'>
> & {
  content: Owner[];
};
