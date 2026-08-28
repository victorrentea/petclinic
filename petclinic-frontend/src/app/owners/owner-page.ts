import { Owner } from './owner';

/** The raw Spring `Page<OwnerDto>` envelope returned by GET /api/owners. */
export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** Everything GET /api/owners is asked for: the filter plus the paging and sorting state. */
export interface OwnerQuery {
  lastName: string;
  page: number;
  size: number;
  sort: string;
}
