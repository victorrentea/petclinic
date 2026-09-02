import {Pet} from '../pets/pet';
import {earliestVisitDate, latestVisitDate, MAX_YEARS_AHEAD} from './visit-date-bounds';

// GitHub issue #40. The backend's VisitDateRange is what makes the rule binding;
// these cover the bounds the datepicker hands to Material.
describe('visit date bounds', () => {
  const petBornOn = (birthDate: string) => ({birthDate} as Pet);

  it('uses the pet birth date as the earliest allowed visit', () => {
    expect(earliestVisitDate(petBornOn('2018-12-23'))).toEqual(new Date('2018-12-23'));
  });

  it('has no lower bound before the pet has loaded', () => {
    expect(earliestVisitDate(undefined)).toBeUndefined();
  });

  it('has no lower bound for a pet with no birth date', () => {
    expect(earliestVisitDate({} as Pet)).toBeUndefined();
  });

  it('allows exactly one year ahead', () => {
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() + MAX_YEARS_AHEAD);
    expect(latestVisitDate().toDateString()).toEqual(expected.toDateString());
  });
});
