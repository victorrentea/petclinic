import * as moment from 'moment';
import {Pet} from '../pets/pet';

// A visit falls between the pet's birth and one year from today, both inclusive (issue #40).
// The backend holds the same rule (Pet.checkVisitDate); the form only spares the round trip.

export function earliestVisitDate(pet: Pet): moment.Moment | null {
  return pet.birthDate ? moment(pet.birthDate) : null;
}

export function latestVisitDate(): moment.Moment {
  return moment().startOf('day').add(1, 'year');
}
