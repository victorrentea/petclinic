import {fromQueryParams, toQueryParams} from './owner-list-url';
import {DEFAULT_OWNER_QUERY, OwnerQuery} from '../owner-page';

describe('owner list URL state', () => {

  it('survives a round trip through the URL', () => {
    const query: OwnerQuery = {lastName: 'Dav', page: 2, size: 20, sort: 'city', dir: 'desc'};

    expect(fromQueryParams(toQueryParams(query))).toEqual(query);
  });

  it('keeps the URL short: an empty last name is left out', () => {
    expect(toQueryParams(DEFAULT_OWNER_QUERY)).toEqual({page: 0, size: 10, sort: 'name', dir: 'asc'});
  });

  it('falls back to the defaults when the URL says nothing', () => {
    expect(fromQueryParams({})).toEqual(DEFAULT_OWNER_QUERY);
    expect(fromQueryParams(undefined)).toEqual(DEFAULT_OWNER_QUERY);
  });

  it('replaces each invalid value with its default, keeping the valid ones', () => {
    expect(fromQueryParams({page: '-1', size: '50000', sort: 'telephone', dir: 'up', lastName: 'Fr'}))
      .toEqual({...DEFAULT_OWNER_QUERY, lastName: 'Fr'});
    expect(fromQueryParams({page: 'abc', size: '5', sort: 'city'}))
      .toEqual({...DEFAULT_OWNER_QUERY, size: 5, sort: 'city'});
  });
});
