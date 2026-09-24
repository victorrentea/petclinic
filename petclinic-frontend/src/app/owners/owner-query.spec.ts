import {convertToParamMap} from '@angular/router';
import {DEFAULT_OWNER_QUERY, nonDefaultParams, ownerQueryFrom} from './owner-query';

describe('ownerQueryFrom', () => {
  const parse = (params: {[key: string]: string}) => ownerQueryFrom(convertToParamMap(params));

  it('defaults every missing value', () => {
    expect(parse({})).toEqual(DEFAULT_OWNER_QUERY);
  });

  it('reads every valid value', () => {
    expect(parse({lastName: 'Pot', page: '2', size: '5', sort: 'city', direction: 'desc'}))
      .toEqual({lastName: 'Pot', page: 2, size: 5, sort: 'city', direction: 'desc'});
  });

  it('replaces invalid values by their defaults', () => {
    expect(parse({page: '-1', size: '7', sort: 'telephone', direction: 'up'})).toEqual(DEFAULT_OWNER_QUERY);
    expect(parse({page: 'abc'}).page).toBe(0);
    expect(parse({page: '1.5'}).page).toBe(0);
  });
});

describe('nonDefaultParams', () => {
  it('is empty for the default query', () => {
    expect(nonDefaultParams(DEFAULT_OWNER_QUERY)).toEqual({});
  });

  it('keeps only the values that differ from their default', () => {
    expect(nonDefaultParams({...DEFAULT_OWNER_QUERY, lastName: 'Pot', page: 1, direction: 'desc'}))
      .toEqual({lastName: 'Pot', page: '1', direction: 'desc'});
  });
});
