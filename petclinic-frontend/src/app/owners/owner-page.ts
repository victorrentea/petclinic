import { Owner } from './owner';

export interface OwnerPage {
  content: Owner[];
  page: { size: number; number: number; totalElements: number; totalPages: number; };
}
