import { components } from '../generated/api-types';

export type OwnerListItem = Required<components['schemas']['OwnerListItemDto']>;

export type OwnerPage = Required<components['schemas']['OwnerPageDto']> & {
  content: OwnerListItem[];
};
