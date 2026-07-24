import { components } from '../generated/api-types';
import { Owner } from './owner';

/**
 * The `PageDto<OwnerDto>` envelope returned by `GET /api/owners`.
 *
 * Derived from the generated contract type rather than restated, so a change to the envelope on the
 * server breaks compilation here instead of surfacing as a runtime surprise. Only `content` is
 * overridden — for the same reason `owner.ts` overrides it: the app's `Owner` narrows the generated
 * `OwnerDto` (non-optional `id`, `Pet[]` rather than the generated pet shape).
 */
export type OwnerPage = Omit<components['schemas']['PageDtoOwnerDto'], 'content'> & {
  content: Owner[];
};

export type SortDirection = 'asc' | 'desc';

/** Sortable columns, named exactly as the server names its sort properties. */
export type OwnerSortColumn = 'lastName' | 'city';

/**
 * The whole list state. It lives in the URL query string and is passed straight through to the
 * API, so back/forward/refresh and deep links work without any component-held state.
 */
export interface OwnerQuery {
  page: number;
  size: number;
  sort: OwnerSortColumn;
  direction: SortDirection;
  lastName: string;
}

/** Must stay equal to the server's `spring.data.web.pageable.max-page-size` ceiling of 20. */
export const OWNER_PAGE_SIZE_OPTIONS = [5, 10, 20];

/** Must stay identical to the server-side defaults. */
export const DEFAULT_OWNER_QUERY: OwnerQuery = {
  page: 0,
  size: 10,
  sort: 'lastName',
  direction: 'asc',
  lastName: ''
};

export const EMPTY_OWNER_PAGE: OwnerPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: DEFAULT_OWNER_QUERY.size
};
