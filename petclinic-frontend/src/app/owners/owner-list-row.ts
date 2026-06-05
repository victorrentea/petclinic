// Hand-written interfaces for the paginated owners list read-model.
// Intentionally NOT derived from generated/api-types.ts (frozen contract).

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 0-based page index
  size: number;
}

export interface OwnerListRow {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  petNames: string[];
}
