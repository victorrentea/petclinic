import {Params} from '@angular/router';

export type OwnerSort = 'name' | 'city';
export type SortDirection = 'asc' | 'desc';

/** What the owners grid shows; the browser address is its only source of truth. */
export interface OwnerQuery {
  lastName: string;
  page: number;
  size: number;
  sort: OwnerSort;
  direction: SortDirection;
}

export const PAGE_SIZES: readonly number[] = [5, 10, 20];
const SORTS: readonly OwnerSort[] = ['name', 'city'];
const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

export const DEFAULT_OWNER_QUERY: Readonly<OwnerQuery> = {
  lastName: '',
  page: 0,
  size: 10,
  sort: 'name',
  direction: 'asc'
};

/** Reads a query from URL parameters, replacing any value the backend would reject by its default. */
export function ownerQueryFrom(params: {get(name: string): string | null}): OwnerQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sort = params.get('sort') as OwnerSort;
  const direction = params.get('direction') as SortDirection;
  return {
    lastName: params.get('lastName') ?? DEFAULT_OWNER_QUERY.lastName,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_OWNER_QUERY.page,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_OWNER_QUERY.size,
    sort: SORTS.includes(sort) ? sort : DEFAULT_OWNER_QUERY.sort,
    direction: DIRECTIONS.includes(direction) ? direction : DEFAULT_OWNER_QUERY.direction
  };
}

/** The query as string parameters, leaving out every value equal to its default. */
export function nonDefaultParams(query: OwnerQuery): Params {
  const params: Params = {};
  for (const key of Object.keys(DEFAULT_OWNER_QUERY) as (keyof OwnerQuery)[]) {
    if (query[key] !== DEFAULT_OWNER_QUERY[key]) {
      params[key] = String(query[key]);
    }
  }
  return params;
}
