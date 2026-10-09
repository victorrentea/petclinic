import { components } from '../generated/api-types';

/** One page of the Owners grid, as GET /api/owners returns it. */
export type OwnerPage = components['schemas']['OwnerPageDto'];
export type OwnerListItem = components['schemas']['OwnerListItemDto'];

/** The grid's query: everything that decides which owners a page holds. */
export interface OwnerQuery {
  lastName: string;
  page: number;       // zero-based, as the API counts
  size: number;
  sort: 'name' | 'city';
  direction: 'asc' | 'desc';
}
