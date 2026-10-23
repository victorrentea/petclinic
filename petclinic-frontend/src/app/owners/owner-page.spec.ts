import { convertToParamMap } from '@angular/router';
import { DEFAULT_OWNER_QUERY, ownerQueryFrom, urlParamsOf } from './owner-page';

describe('The Owners grid in the address bar', () => {
  it('reads search, sort, page and size, the page counting from 1', () => {
    const query = ownerQueryFrom(convertToParamMap({lastName: 'Dar', sort: 'city,desc', page: '3', size: '20'}));

    expect(query).toEqual({lastName: 'Dar', page: 2, size: 20, sort: 'city,desc'});
  });

  it('a bare address is the default view', () => {
    expect(ownerQueryFrom(convertToParamMap({}))).toEqual(DEFAULT_OWNER_QUERY);
  });

  it('a value the grid cannot show falls back to its default', () => {
    const query = ownerQueryFrom(convertToParamMap({sort: 'telephone,asc', page: '-2', size: '50000'}));

    expect(query).toEqual(DEFAULT_OWNER_QUERY);
  });

  it('writes only what differs from the default', () => {
    expect(urlParamsOf(DEFAULT_OWNER_QUERY)).toEqual({});
    expect(urlParamsOf({lastName: 'Dar', page: 2, size: 20, sort: 'city,desc'}))
      .toEqual({lastName: 'Dar', sort: 'city,desc', page: 3, size: 20});
  });

  it('reads back what it writes', () => {
    const query = {lastName: 'Mur', page: 4, size: 5, sort: 'name,desc'};

    expect(ownerQueryFrom(convertToParamMap(urlParamsOf(query)))).toEqual(query);
  });
});
