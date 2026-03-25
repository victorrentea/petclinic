import { Owner } from './owner';

export interface OwnerPage {
  owners: Owner[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}
