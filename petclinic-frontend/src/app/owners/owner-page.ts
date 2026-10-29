import { Params, ParamMap } from '@angular/router';
import { Owner } from './owner';

/** One page of owners, as GET /api/owners answers it. */
export interface OwnerPage {
  content: Owner[];
  totalElements: number;
}

/** What the Owners grid asks for: a last-name prefix, a page from 0, 5/10/20 rows, `name|city,asc|desc`. */
export interface OwnerQuery {
  lastName: string;
  page: number;
  size: number;
  sort: string;
}

export const PAGE_SIZES = [5, 10, 20];
export const DEFAULT_OWNER_QUERY: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};
const SORTS = /^(name|city),(asc|desc)$/;

/**
 * The grid's view, read from the address bar so a refresh, a Back or a shared link shows the
 * same page. Pages count from 1 there, as people read them; a value the grid cannot show
 * falls back to its default instead of breaking the page.
 */
export function ownerQueryFrom(params: ParamMap): OwnerQuery {
  const size = Number(params.get('size'));
  const page = Number(params.get('page'));
  const sort = params.get('sort');
  return {
    lastName: params.get('lastName') ?? DEFAULT_OWNER_QUERY.lastName,
    page: Number.isInteger(page) && page >= 1 ? page - 1 : DEFAULT_OWNER_QUERY.page,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_OWNER_QUERY.size,
    sort: sort && SORTS.test(sort) ? sort : DEFAULT_OWNER_QUERY.sort,
  };
}

/** The address bar for a view: only what differs from the default, so `/owners` stays a clean link. */
export function urlParamsOf(query: OwnerQuery): Params {
  const params: Params = {};
  if (query.lastName) {
    params.lastName = query.lastName;
  }
  if (query.sort !== DEFAULT_OWNER_QUERY.sort) {
    params.sort = query.sort;
  }
  if (query.page !== DEFAULT_OWNER_QUERY.page) {
    params.page = query.page + 1;
  }
  if (query.size !== DEFAULT_OWNER_QUERY.size) {
    params.size = query.size;
  }
  return params;
}
