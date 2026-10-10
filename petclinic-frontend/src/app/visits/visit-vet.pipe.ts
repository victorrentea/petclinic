import {Pipe, PipeTransform} from '@angular/core';
import {Visit} from './visit';
import {Vet} from '../vets/vet';

export const NO_VET = 'No vet';

export interface VetOption {
  id: number;
  name: string;
}

/** The vets as the visit forms' combo offers them: one label per vet, bound by id. */
export function toVetOptions(vets: Vet[]): VetOption[] {
  return vets.map(vet => ({id: vet.id, name: `${vet.firstName} ${vet.lastName}`}));
}

/** The vet who attended a visit, or {@link NO_VET} for a visit that has none. */
@Pipe({name: 'visitVet'})
export class VisitVetPipe implements PipeTransform {
  transform(visit: Visit): string {
    return visit.vetId == null ? NO_VET : `${visit.vetFirstName} ${visit.vetLastName}`;
  }
}
