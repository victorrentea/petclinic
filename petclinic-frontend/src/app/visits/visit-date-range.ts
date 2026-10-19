import * as moment from 'moment';

/** A visit is dated between the pet's birth and one year from today (issue #40). */
export class VisitDateRange {
  readonly min: moment.Moment;
  readonly max = moment().startOf('day').add(1, 'year');

  constructor(petBirthDate?: string) {
    this.min = petBirthDate ? moment(petBirthDate) : null;
  }
}
