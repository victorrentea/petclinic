import * as moment from 'moment';
import {Pet} from '../pets/pet';

/** Issue #40: a visit falls between the pet's birth and one year from today. */
export function earliestVisitDate(pet: Pet): moment.Moment | null {
  return pet?.birthDate ? moment(pet.birthDate, 'YYYY-MM-DD') : null;
}

export function latestVisitDate(): moment.Moment {
  return moment().startOf('day').add(1, 'year');
}
