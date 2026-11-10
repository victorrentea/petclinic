import { components } from '../generated/api-types';
import { Owner } from './owner';

type Schemas = components['schemas'];

export type OwnerPage = Omit<Schemas['PagedModelOwnerDto'], 'content' | 'page'> & {
  content: Owner[];
  page: Required<Schemas['PageMetadata']>;
};

export interface OwnerQuery {
  page?: number;
  size?: number;
  sort?: string;
  lastName?: string;
}
