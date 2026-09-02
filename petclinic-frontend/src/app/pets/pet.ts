import { components } from '../generated/api-types';
import { Owner } from '../owners/owner';
import { Visit } from '../visits/visit';

export type Pet = Omit<components['schemas']['PetDto'], 'ownerId' | 'visits'> & {
  ownerId: number;
  visits: Visit[];
  owner: Owner;
};
