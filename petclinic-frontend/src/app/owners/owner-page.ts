import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export type OwnerPageQuery = NonNullable<operations['listOwners']['parameters']['query']>;
export type OwnerPageSize = NonNullable<OwnerPageQuery['size']>;
export type OwnerSort = NonNullable<OwnerPageQuery['sort']>;
