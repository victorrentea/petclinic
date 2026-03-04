import {Owner} from '../owners/owner';
import {Visit} from '../visits/visit';
import {PetType} from '../pettypes/pettype';

export interface Pet {
  id: number;
  ownerId: number;
  name: string;
  birthDate: string;
  type: PetType;
  owner: Owner;
  visits: Visit[];
}
