import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** What `GET /api/owners` is asked for; `sort` is `<name|city>,<asc|desc>`. */
export interface OwnerPageQuery {
  lastName: string;
  page: number;
  size: number;
  sort: string;
}
