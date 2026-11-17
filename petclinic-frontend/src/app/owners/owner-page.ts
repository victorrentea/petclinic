import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const PAGE_SIZES = [5, 10, 20] as const;
export type PageSize = typeof PAGE_SIZES[number];
export type OwnerSortField = 'lastName' | 'city';
export type SortDirection = 'asc' | 'desc';

/** The applied state of the owners grid: what the URL carries and what the API is asked for. */
export interface OwnerQuery {
  page: number;
  size: PageSize;
  sortField: OwnerSortField;
  sortDirection: SortDirection;
  lastName: string;
}

export const DEFAULT_OWNER_QUERY: OwnerQuery = {
  page: 0, size: 10, sortField: 'lastName', sortDirection: 'asc', lastName: ''
};
