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

/** What the API answers when no parameter is sent. */
export const FIRST_OWNER_PAGE: OwnerPageQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};
