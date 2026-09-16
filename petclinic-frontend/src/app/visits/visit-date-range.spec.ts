import * as moment from 'moment';
import {computeVisitDateBounds} from './visit-date-range';

describe('computeVisitDateBounds', () => {
  it('returns the pet birth date as minDate when provided', () => {
    const bounds = computeVisitDateBounds('2010-09-07');

    expect(bounds.minDate).toEqual(moment('2010-09-07').toDate());
  });

  it('returns undefined minDate when the pet has no birth date', () => {
    const bounds = computeVisitDateBounds(undefined);

    expect(bounds.minDate).toBeUndefined();
  });

  it('returns maxDate one year from today', () => {
    const bounds = computeVisitDateBounds('2010-09-07');

    expect(bounds.maxDate.toDateString()).toEqual(moment().add(1, 'year').toDate().toDateString());
  });
});
