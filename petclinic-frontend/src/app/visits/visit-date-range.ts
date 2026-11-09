import * as moment from 'moment';

/** The furthest a visit can be booked: one year from today. The earliest is the pet's birth date. */
export function latestVisitDate(): string {
  return moment().add(1, 'year').format('YYYY-MM-DD');
}
