import { components } from '../generated/api-types';
import { Owner } from './owner';

/** Paged response for the owner listing, derived from the generated OpenAPI contract. */
export type OwnerPage = Omit<components['schemas']['PageOwnerDto'], 'content'> & {
  content: Owner[];
};
