import {ValidationErrors} from '@angular/forms';
import * as moment from 'moment';
import {Pet} from '../pets/pet';

/**
 * A visit is dated between the pet's birth and one year from today (issue #40).
 * A visit already dated outside that range (booked before the rule) stays editable as it is.
 */
export class VisitDateRange {
  readonly min: moment.Moment;
  readonly max: moment.Moment;

  constructor(private readonly pet?: Pet, currentVisitDate?: string) {
    const current = currentVisitDate ? moment(currentVisitDate) : null;
    const birth = pet?.birthDate ? moment(pet.birthDate) : null;
    const aYearAhead = moment().startOf('day').add(1, 'year');
    this.min = birth && current ? moment.min(birth, current) : birth;
    this.max = current ? moment.max(aYearAhead, current) : aYearAhead;
  }

  /** Why the datepicker refused the date, or null when the date is within range. */
  errorIn(errors: ValidationErrors | null): string | null {
    if (errors?.matDatepickerMin) {
      return `The visit cannot predate ${this.pet.name}, born ${this.pet.birthDate}`;
    }
    if (errors?.matDatepickerMax) {
      return `Book at most one year ahead, by ${this.max.format('YYYY-MM-DD')}`;
    }
    return null;
  }
}
