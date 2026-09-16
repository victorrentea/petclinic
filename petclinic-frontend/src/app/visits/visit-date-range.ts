import * as moment from 'moment';

/**
 * The allowed window for a visit date: from the pet's birth (inclusive) to one year from today
 * (inclusive). Shared by visit-add and visit-edit so the datepicker bounds stay in sync (bug #40).
 */
export function computeVisitDateBounds(petBirthDate: string | Date | undefined): { minDate: Date | undefined; maxDate: Date } {
  return {
    minDate: petBirthDate ? moment(petBirthDate).toDate() : undefined,
    maxDate: moment().add(1, 'year').toDate()
  };
}
