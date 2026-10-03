import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export type OwnerSort = NonNullable<NonNullable<operations['listOwners']['parameters']['query']>['sort']>;

export interface OwnerPageQuery {
  lastName: string;
  page: number;
  size: number;
  sort: OwnerSort;
}

export const OWNER_PAGE_SIZES = [5, 10, 20];

export const DEFAULT_OWNER_PAGE_QUERY: OwnerPageQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};
