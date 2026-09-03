import { components } from '../generated/api-types';

/** One row of the owners grid: the owner's own fields, without their pets. */
export type OwnerRow = Omit<components['schemas']['OwnerRowDto'], 'id'> & {
  id: number;
};

/** What GET /api/owners returns: one page of rows plus where it sits in the whole result set. */
export type OwnerPage = {
  content: OwnerRow[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
};

export type OwnerSortField = 'NAME' | 'CITY';
export type SortDirection = 'ASC' | 'DESC';

/** Everything the grid needs to ask for a page. Mirrors the endpoint's query parameters. */
export interface OwnerSearchCriteria {
  lastName: string;
  page: number;
  size: number;
  sort: OwnerSortField;
  dir: SortDirection;
}

export const DEFAULT_OWNER_CRITERIA: OwnerSearchCriteria = {
  lastName: '',
  page: 0,
  size: 10,
  sort: 'NAME',
  dir: 'ASC'
};

export const OWNER_PAGE_SIZES = [5, 10, 20];
