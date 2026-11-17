import {convertToParamMap, Params} from '@angular/router';
import {DEFAULT_OWNER_QUERY} from './owner-page';
import {parseOwnerQuery, toQueryParams} from './owner-query';

const parse = (params: Params) => parseOwnerQuery(convertToParamMap(params));

describe('parseOwnerQuery', () => {
  it('uses the defaults without asking for a correction when nothing is given', () => {
    expect(parse({})).toEqual({query: DEFAULT_OWNER_QUERY});
  });

  it('reads a valid deep link', () => {
    expect(parse({page: '2', size: '5', sort: 'city,desc', lastName: 'Dav'})).toEqual({
      query: {page: 2, size: 5, sortField: 'city', sortDirection: 'desc', lastName: 'Dav'}
    });
  });

  it('replaces each invalid field alone and keeps the valid ones', () => {
    const parsed = parse({page: '-1', size: '7', sort: 'pets,asc', lastName: 'Dav'});

    expect(parsed.query).toEqual({...DEFAULT_OWNER_QUERY, lastName: 'Dav'});
    expect(parsed.correction).toEqual({page: '0', size: '10', sort: 'lastName,asc', lastName: 'Dav'});
  });

  it('corrects only what is wrong', () => {
    const parsed = parse({page: '3', size: '7'});

    expect(parsed.query.page).toBe(3);
    expect(parsed.correction).toEqual({page: '3', size: '10'});
  });

  it('treats duplicated fields as invalid', () => {
    const parsed = parse({page: ['1', '2'], lastName: ['A', 'B']});

    expect(parsed.query).toEqual(DEFAULT_OWNER_QUERY);
    expect(parsed.correction).toEqual({page: '0', lastName: ''});
  });

  ['abc', '1.5', '', ' 1', '99999999999', '2147483648', '1e3', '-0'].forEach(page =>
    it(`rejects page "${page}"`, () => {
      expect(parse({page}).correction).toEqual({page: '0'});
    }));

  it('rejects a filter containing a NUL character', () => {
    expect(parse({lastName: 'Fr\u0000anklin'}).correction).toEqual({lastName: ''});
  });

  it('accepts the largest page the API accepts', () => {
    expect(parse({page: '2147483647'})).toEqual({query: {...DEFAULT_OWNER_QUERY, page: 2147483647}});
  });

  ['lastName', 'lastName,up', 'lastName,asc,city,asc', 'firstName,asc',
    'address,asc', 'telephone,desc', ',asc', 'LASTNAME,asc'].forEach(sort =>
    it(`rejects sort "${sort}"`, () => {
      expect(parse({sort}).correction).toEqual({sort: 'lastName,asc'});
    }));
});

describe('toQueryParams', () => {
  it('writes the whole state, leaving an empty filter out', () => {
    expect(toQueryParams(DEFAULT_OWNER_QUERY)).toEqual({page: 0, size: 10, sort: 'lastName,asc'});
    expect(toQueryParams({...DEFAULT_OWNER_QUERY, lastName: 'Dav'}).lastName).toBe('Dav');
  });
});
