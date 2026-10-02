import {ParamMap} from '@angular/router';
import {OwnerSort} from './owner-page';

export interface OwnerListQuery {
  page: number;
  size: number;
  sort: OwnerSort;
  lastName: string;
}

export const DEFAULT_OWNER_LIST_QUERY: OwnerListQuery = {
  page: 0, size: 10, sort: 'name,asc', lastName: ''
};

type QueryResult = {valid: true; query: OwnerListQuery} | {valid: false; reason: string};

function isOwnerSort(value: string): value is OwnerSort {
  return ['name,asc', 'name,desc', 'city,asc', 'city,desc'].includes(value);
}

export function readOwnerListQuery(params: ParamMap): QueryResult {
  for (const name of ['page', 'size', 'sort', 'lastName']) {
    if (params.getAll(name).length > 1) {
      return {valid: false, reason: `${name} must appear only once`};
    }
  }
  const rawPage = params.get('page') ?? String(DEFAULT_OWNER_LIST_QUERY.page);
  const rawSize = params.get('size') ?? String(DEFAULT_OWNER_LIST_QUERY.size);
  const page = Number(rawPage);
  const size = Number(rawSize);
  if (!/^\d+$/.test(rawSize) || ![5, 10, 20].includes(size)) {
    return {valid: false, reason: 'size must be 5, 10, or 20'};
  }
  if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page * size > 2147483647) {
    return {valid: false, reason: 'page must be nonnegative with a representable offset'};
  }
  const sort = params.get('sort') ?? DEFAULT_OWNER_LIST_QUERY.sort;
  if (!isOwnerSort(sort)) {
    return {valid: false, reason: 'sort must be name or city, ascending or descending'};
  }
  return {valid: true, query: {page, size, sort, lastName: params.get('lastName') ?? ''}};
}
