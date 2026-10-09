import * as moment from 'moment';

// Issue #40: a visit is dated between the pet's birth and one year from today.
// The backend enforces the same rule (Pet.checkVisitDate); this only spares the round trip.

export function earliestVisitDate(petBirthDate: string): moment.Moment {
  return moment(petBirthDate, 'YYYY-MM-DD');
}

export function latestVisitDate(): moment.Moment {
  return moment().startOf('day').add(1, 'year');
}
