import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export type OwnerQuery = NonNullable<operations['listOwners']['parameters']['query']>;

export type OwnerSort = NonNullable<OwnerQuery['sort']>;
