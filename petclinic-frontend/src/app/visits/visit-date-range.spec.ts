import * as moment from 'moment';
import {Pet} from '../pets/pet';
import {VisitDateRange} from './visit-date-range';

describe('VisitDateRange', () => {
  const dapple = {name: 'Dapple', birthDate: '2020-03-01'} as Pet;

  it('starts on the pet birth date and ends one year from today', () => {
    const range = new VisitDateRange(dapple);

    expect(range.min.format('YYYY-MM-DD')).toBe('2020-03-01');
    expect(range.max.format('YYYY-MM-DD')).toBe(moment().add(1, 'year').format('YYYY-MM-DD'));
  });

  it('keeps a visit dated before the rule editable', () => {
    const range = new VisitDateRange(dapple, '0009-07-20');

    expect(range.min.format('YYYY-MM-DD')).toBe('0009-07-20');
  });

  it('keeps a visit booked further ahead editable', () => {
    const farAhead = moment().add(2, 'years').format('YYYY-MM-DD');

    expect(new VisitDateRange(dapple, farAhead).max.format('YYYY-MM-DD')).toBe(farAhead);
  });

  it('has no lower bound before the pet is loaded', () => {
    expect(new VisitDateRange().min).toBeNull();
  });

  it('explains a date before the birth', () => {
    expect(new VisitDateRange(dapple).errorIn({matDatepickerMin: {}}))
      .toBe('The visit cannot predate Dapple, born 2020-03-01');
  });

  it('explains a date too far ahead', () => {
    const range = new VisitDateRange(dapple);

    expect(range.errorIn({matDatepickerMax: {}}))
      .toBe(`Book at most one year ahead, by ${range.max.format('YYYY-MM-DD')}`);
  });

  it('says nothing about other errors', () => {
    expect(new VisitDateRange(dapple).errorIn({required: true})).toBeNull();
    expect(new VisitDateRange(dapple).errorIn(null)).toBeNull();
  });
});
