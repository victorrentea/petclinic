import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** What the Owners grid asks the server for. */
export interface OwnerQuery {
  page: number;
  size: number;
  sort: string;
  lastName: string;
}
