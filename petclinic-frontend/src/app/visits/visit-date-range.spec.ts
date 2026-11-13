import * as moment from 'moment';
import {Pet} from '../pets/pet';
import {earliestVisitDate, latestVisitDate} from './visit-date-range';

describe('visit date range', () => {
  it('starts on the pet\'s birth date', () => {
    expect(earliestVisitDate({birthDate: '2024-05-10'} as Pet).format('YYYY-MM-DD')).toBe('2024-05-10');
  });

  it('has no start for a pet with no birth date', () => {
    expect(earliestVisitDate({} as Pet)).toBeNull();
  });

  it('ends one year from today', () => {
    expect(latestVisitDate().isSame(moment().add(1, 'year'), 'day')).toBeTrue();
  });
});
