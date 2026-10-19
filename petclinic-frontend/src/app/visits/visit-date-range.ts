import {ValidationErrors} from '@angular/forms';
import * as moment from 'moment';
import {Pet} from '../pets/pet';

/** A visit is dated between the pet's birth and one year from today (issue #40). */
export class VisitDateRange {
  readonly min: moment.Moment;
  readonly max = moment().startOf('day').add(1, 'year');

  constructor(private readonly pet?: Pet) {
    this.min = pet?.birthDate ? moment(pet.birthDate) : null;
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
