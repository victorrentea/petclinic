import { operations } from '../generated/api-types';
import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

type ListOwnersQuery = Required<NonNullable<operations['listOwners']['parameters']['query']>>;
export type OwnerSort = ListOwnersQuery['sort'];
export type PageSize = ListOwnersQuery['size'];

/** As the API takes it: `page` is 0-based. */
export interface OwnerPageQuery {
  lastName: string;
  page: number;
  size: PageSize;
  sort: OwnerSort;
}
