import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export type OwnerListQuery = NonNullable<operations['listOwners']['parameters']['query']>;

export type OwnerSort = NonNullable<OwnerListQuery['sort']>;
