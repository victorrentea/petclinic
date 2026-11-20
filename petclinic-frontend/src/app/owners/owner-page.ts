import { components } from '../generated/api-types';
import { Owner } from './owner';

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

export interface OwnerQuery {
  lastName: string;
  page: number;
  size: number;
  sort: string;
}
