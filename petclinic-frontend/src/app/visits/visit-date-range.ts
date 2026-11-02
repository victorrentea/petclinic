import * as moment from 'moment';

export interface VisitDateRange {
  min: moment.Moment;
  max: moment.Moment;
}

export function visitDateRange(petBirthDate: string): VisitDateRange {
  return {
    min: moment(petBirthDate, 'YYYY-MM-DD'),
    max: moment().startOf('day').add(1, 'year'),
  };
}
