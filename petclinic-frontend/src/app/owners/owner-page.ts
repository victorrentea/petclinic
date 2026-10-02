import { Owner } from './owner';
import { components } from '../generated/api-types';

export type OwnerPage = Omit<Required<components['schemas']['OwnerPageDto']>, 'content'> & {
  content: Owner[];
};

export type OwnerSortKey = 'name' | 'city';
export type OwnerSortDirection = 'asc' | 'desc';
export type OwnerSort = `${OwnerSortKey},${OwnerSortDirection}`;
