import * as moment from 'moment';

/** #40: a visit is dated at most one year from today; the earliest is the pet's birth date. */
export function latestVisitDate(): moment.Moment {
  return moment().add(1, 'year');
}
