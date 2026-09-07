import {Pet} from '../pets/pet';
import {earliestVisitDate, latestVisitDate} from './visit-date-range';

// The bounds of GitHub issue #40. The date-only arithmetic is the whole point here:
// a visit may not predate its pet, and may not be booked more than a year out.

const petBornOn = (birthDate: any): Pet => ({birthDate} as Pet);

describe('visit date range', () => {

  describe('earliestVisitDate', () => {

    it('is the pet birth date', () => {
      const earliest = earliestVisitDate(petBornOn('2018-08-06'));

      expect(earliest).toEqual(new Date(2018, 7, 6));
    });

    it('reads the birth date in the local zone, not UTC', () => {
      // new Date('2018-08-06') is UTC midnight, which is 5 Aug west of Greenwich.
      const earliest = earliestVisitDate(petBornOn('2018-08-06'));

      expect(earliest.getDate()).toBe(6);
      expect(earliest.getMonth()).toBe(7);
      expect(earliest.getFullYear()).toBe(2018);
    });

    it('is unknown when the pet has no birth date', () => {
      expect(earliestVisitDate(petBornOn(null))).toBeNull();
      expect(earliestVisitDate(petBornOn(undefined))).toBeNull();
    });

    it('is unknown when there is no pet yet', () => {
      expect(earliestVisitDate(undefined as any)).toBeNull();
    });
  });

  describe('latestVisitDate', () => {

    it('is one year from today', () => {
      const today = new Date();

      const latest = latestVisitDate();

      expect(latest.getFullYear()).toBe(today.getFullYear() + 1);
      expect(latest.getMonth()).toBe(today.getMonth());
      expect(latest.getDate()).toBe(today.getDate());
    });
  });
});
