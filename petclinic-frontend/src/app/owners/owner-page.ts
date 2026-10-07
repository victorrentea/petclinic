import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
