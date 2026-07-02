import { components } from '../generated/api-types';
import { Owner } from './owner';

// Matches the backend PagedModel<OwnerDto>: { content: [...], page: { size, number,
// totalElements, totalPages } }. The metadata shape is taken from the generated
// OpenAPI types; only `content` is narrowed to our richer Owner (id: number, pets: Pet[]).
export type OwnerPage = Omit<components['schemas']['PagedModelOwnerDto'], 'content'> & {
  content: Owner[];
};
