import {Pipe, PipeTransform} from '@angular/core';
import {Visit} from './visit';

/**
 * "Who attended this visit", in one place. The vet is optional — legacy rows and
 * MCP-booked visits have none — and the em-dash fallback was being spelled out
 * inline in every template that renders a visit row, so the rule now lives here.
 */
@Pipe({name: 'vetName'})
export class VetNamePipe implements PipeTransform {
  static readonly NOT_ATTENDED = '—';

  transform(visit: Pick<Visit, 'vetFirstName' | 'vetLastName'> | null | undefined): string {
    if (!visit?.vetFirstName) {
      return VetNamePipe.NOT_ATTENDED;
    }
    return `${visit.vetFirstName} ${visit.vetLastName}`;
  }
}
