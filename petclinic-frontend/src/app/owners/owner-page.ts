import { components } from '../generated/api-types';
import { Owner } from './owner';

/**
 * One page of owners, exactly as the API defines it — the envelope is derived from
 * the generated schema, so a change to the contract shows up here as a compile error
 * rather than as a silently wrong screen. Only `content` is narrowed, the same way
 * `owner.ts` narrows OwnerDto.
 */
export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

/** The page sizes the grid offers, and the one it starts on. */
export const PAGE_SIZES = [5, 10, 20];
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_SORT = 'name,asc';

/** Everything that decides which owners the grid shows. Mirrors the query string. */
export interface OwnerQuery {
  lastName: string;
  page: number;
  size: number;
  sort: string;
}
