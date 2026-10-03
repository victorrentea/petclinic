import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

/** Every parameter of the owners list; the service sends all of them, never relying on server defaults. */
export type OwnerQuery = Required<NonNullable<operations['listOwners']['parameters']['query']>>;

export const DEFAULT_OWNER_QUERY: Readonly<OwnerQuery> = { lastName: '', page: 0, size: 10, sort: 'name,asc' };
