import {Owner} from './owner';

export interface OwnerPage {
  content: Owner[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OwnerSearchRequest {
  page: number;
  size: number;
  sort: string;
  q: string;
}
