import { Owner } from './owner';

/** Mirrors the backend `PagedModel<OwnerDto>` envelope: rows in `content`, metadata under `page`. */
export interface OwnerPage {
  content: Owner[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}
