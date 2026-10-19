import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
}

/** Which page of owners to list; the backend's defaults apply to what is left out. */
export interface OwnerQuery {
  page?: number;
  size?: number;
  sort?: string;
  lastName?: string;
}
