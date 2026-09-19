import { components } from '../generated/api-types';

export type Vet = components['schemas']['VetDto'];

/** One row of an `<app-combo>` of vets: the id that gets stored, the name that gets read. */
export interface VetOption {
  id: number;
  name: string;
}

export function toVetOptions(vets: Vet[]): VetOption[] {
  return vets.map(vet => ({id: vet.id, name: `${vet.firstName} ${vet.lastName}`}));
}
