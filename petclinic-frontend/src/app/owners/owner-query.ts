import { ParamMap, Params } from '@angular/router';
import {
  DEFAULT_OWNER_QUERY, OwnerQuery, OwnerSortField, PAGE_SIZES, PageSize, SortDirection
} from './owner-page';

const MAX_PAGE = 2147483647; // what the API accepts
const SORT_FIELDS: OwnerSortField[] = ['lastName', 'city'];

export interface ParsedOwnerQuery {
  query: OwnerQuery;
  /** Set only when the URL carries invalid or duplicated values: the URL with those replaced by defaults. */
  correction?: Params;
}

/** The API's and the URL's `sort` value, e.g. `city,desc`. */
export function sortParam(query: Pick<OwnerQuery, 'sortField' | 'sortDirection'>): string {
  return `${query.sortField},${query.sortDirection}`;
}

/** Query parameters for navigating to a state; an empty filter is left out. */
export function toQueryParams(query: OwnerQuery): Params {
  const params: Params = {page: query.page, size: query.size, sort: sortParam(query)};
  if (query.lastName) {
    params.lastName = query.lastName;
  }
  return params;
}

export function sameQuery(a: OwnerQuery, b: OwnerQuery): boolean {
  return a.page === b.page && a.size === b.size && a.sortField === b.sortField
    && a.sortDirection === b.sortDirection && a.lastName === b.lastName;
}

/**
 * Reads the grid state from a URL. Each field is judged alone: a missing one silently takes its
 * default; an invalid or duplicated one takes it too, and the URL is asked to be corrected.
 */
export function parseOwnerQuery(params: ParamMap): ParsedOwnerQuery {
  const defaults = DEFAULT_OWNER_QUERY;
  const correction: Params = {};
  let invalid = false;

  const read = <T>(name: string, parse: (raw: string) => T | undefined, fallback: T,
                    show: (value: T) => string): T => {
    const raw = params.getAll(name);
    if (raw.length === 0) {
      return fallback;
    }
    const parsed = raw.length === 1 ? parse(raw[0]) : undefined;
    invalid = invalid || parsed === undefined;
    correction[name] = parsed === undefined ? show(fallback) : raw[0];
    return parsed === undefined ? fallback : parsed;
  };

  const page = read('page', parsePage, defaults.page, String);
  const size = read('size', parseSize, defaults.size, String);
  const sort = read('sort', parseSort, {field: defaults.sortField, direction: defaults.sortDirection},
    s => `${s.field},${s.direction}`);
  const lastName = read('lastName', parseLastName, defaults.lastName, String);
  const query: OwnerQuery = {page, size, sortField: sort.field, sortDirection: sort.direction, lastName};
  return invalid ? {query, correction} : {query};
}

function parseLastName(raw: string): string | undefined {
  return raw.includes('\u0000') ? undefined : raw;
}

function parsePage(raw: string): number | undefined {
  return /^\d{1,10}$/.test(raw) && Number(raw) <= MAX_PAGE ? Number(raw) : undefined;
}

function parseSize(raw: string): PageSize | undefined {
  return PAGE_SIZES.find(size => String(size) === raw);
}

function parseSort(raw: string): {field: OwnerSortField; direction: SortDirection} | undefined {
  const [field, direction, ...rest] = raw.split(',');
  const known = SORT_FIELDS.find(candidate => candidate === field);
  const dir = direction === 'asc' || direction === 'desc' ? direction : undefined;
  return known && dir && rest.length === 0 ? {field: known, direction: dir} : undefined;
}
