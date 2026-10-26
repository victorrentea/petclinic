import * as moment from 'moment';

// Mirrors the backend rule (Visit.requireDateWithinRange): from the pet's birth to one year ahead.
export function latestVisitDate(): moment.Moment {
  return moment().startOf('day').add(1, 'year');
}
