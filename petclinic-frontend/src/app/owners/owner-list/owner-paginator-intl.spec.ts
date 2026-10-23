import {OwnerPaginatorIntl} from './owner-paginator-intl';

describe('OwnerPaginatorIntl', () => {
  const intl = new OwnerPaginatorIntl();

  it('names the 1-based page before the row range', () => {
    expect(intl.getRangeLabel(3, 5, 30)).toBe('Page 4 – 16..20 of 30');
  });

  it('clips the range on the last, partial page', () => {
    expect(intl.getRangeLabel(2, 10, 23)).toBe('Page 3 – 21..23 of 23');
  });

  it('says nothing about pages when there are no rows', () => {
    expect(intl.getRangeLabel(0, 5, 0)).toBe('0 of 0');
  });
});
