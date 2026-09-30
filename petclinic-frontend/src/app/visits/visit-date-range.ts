import * as moment from 'moment';

/** Issue #40: a visit is dated between the pet's birth and one year from today. */
export class VisitDateRange {
  readonly max = moment().add(1, 'year');
  readonly maxLabel = this.max.format('YYYY-MM-DD');
  min: moment.Moment | null = null;
  minLabel = '';

  forPetBornOn(birthDate: string): void {
    this.min = moment(birthDate, 'YYYY-MM-DD');
    this.minLabel = birthDate;
  }
}
