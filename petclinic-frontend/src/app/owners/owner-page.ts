import { Owner } from './owner';

/** Server-side page envelope returned by `GET /api/owners` (mirrors backend `OwnerPageDto`). */
export interface OwnerPage {
  content: Owner[];
  totalElements: number;
  page: number;
  size: number;
  totalPages: number;
}
