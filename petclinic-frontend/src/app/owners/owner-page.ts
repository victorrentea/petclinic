import { components } from '../generated/api-types';
import { OwnerListItem } from './owner';

/** A single page of the paginated, sorted owners list - see `OwnerPageDto` in `openapi.yaml`. */
export type OwnerPage = Required<Omit<components['schemas']['OwnerPageDto'], 'content'>> & {
  content: OwnerListItem[];
};
