import {Params} from '@angular/router';
import {DEFAULT_OWNER_QUERY, OwnerQuery} from '../owner-page';

const SIZES: OwnerQuery['size'][] = [5, 10, 20];
const SORTS: OwnerQuery['sort'][] = ['name', 'city'];
const DIRS: OwnerQuery['dir'][] = ['asc', 'desc'];

/** The grid state as URL query params, so refresh and Back land on the same page. */
export function toQueryParams(query: OwnerQuery): Params {
  const {lastName, ...rest} = query;
  return lastName ? {lastName, ...rest} : rest;
}

/** Reads the grid state back from a URL that a user may have edited: anything invalid takes its default. */
export function fromQueryParams(params: Params | undefined): OwnerQuery {
  const p = params ?? {};
  const page = Number(p.page);
  return {
    lastName: typeof p.lastName === 'string' ? p.lastName : DEFAULT_OWNER_QUERY.lastName,
    page: Number.isInteger(page) && page >= 0 ? page : DEFAULT_OWNER_QUERY.page,
    size: SIZES.find(size => size === Number(p.size)) ?? DEFAULT_OWNER_QUERY.size,
    sort: SORTS.find(sort => sort === p.sort) ?? DEFAULT_OWNER_QUERY.sort,
    dir: DIRS.find(dir => dir === p.dir) ?? DEFAULT_OWNER_QUERY.dir,
  };
}
