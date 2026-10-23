import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

/** Every parameter of GET /api/owners, all filled in: the grid always says what it wants. */
export type OwnerQuery = Required<NonNullable<operations['listOwners']['parameters']['query']>>;

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export const DEFAULT_OWNER_QUERY: OwnerQuery = { lastName: '', page: 0, size: 10, sort: 'name', dir: 'asc' };

export const EMPTY_OWNER_PAGE: OwnerPage = { content: [], totalElements: 0 };
