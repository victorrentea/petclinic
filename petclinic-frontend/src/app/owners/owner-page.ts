import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** The list state. It lives in the URL query string and is passed straight through to the API. */
export interface OwnerQuery {
  page: number;
  size: number;
  sort: string;
  lastName: string;
}

export const OWNER_PAGE_SIZE_OPTIONS = [5, 10, 20];

export const DEFAULT_OWNER_QUERY: OwnerQuery = {
  page: 0,
  size: 10,
  sort: 'name,asc',
  lastName: ''
};
