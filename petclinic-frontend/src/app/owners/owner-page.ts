import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

/** Exactly what GET /api/owners answers: one page of owners, and how many match in all. */
export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export type OwnerListQuery = NonNullable<operations['listOwners']['parameters']['query']>;

export type OwnerSort = NonNullable<OwnerListQuery['sort']>;
