import { OwnerSummary } from './owner-summary';

export interface OwnerPage {
  content: OwnerSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
