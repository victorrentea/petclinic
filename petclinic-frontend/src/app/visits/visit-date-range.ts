import * as moment from 'moment';

/** A visit is dated between its pet's birth date and this day (#40); the backend enforces the same. */
export function latestVisitDate(): moment.Moment {
  return moment().startOf('day').add(1, 'year');
}
