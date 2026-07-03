import { components } from '../generated/api-types';
import { Owner } from './owner';

export type OwnerPage = Omit<components['schemas']['OwnerPage'], 'content'> & {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};
