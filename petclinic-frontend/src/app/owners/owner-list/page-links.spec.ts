import {pageLinks} from './page-links';

describe('pageLinks', () => {
  it('shows the only page there is', () => {
    expect(pageLinks(1, 1)).toEqual([1]);
  });

  it('from the first page: the next one, halfway to the end, and the end', () => {
    expect(pageLinks(1, 8)).toEqual([1, 2, '…', 5, '…', 8]);
  });

  it('halves both ways around the current page', () => {
    expect(pageLinks(5, 80)).toEqual([1, '…', 3, 4, 5, 6, '…', 43, '…', 80]);
  });

  it('from the last page: halfway back, the previous one, and the end', () => {
    expect(pageLinks(8, 8)).toEqual([1, '…', 4, '…', 7, 8]);
  });

  it('leaves no gap where the pages already touch', () => {
    expect(pageLinks(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
