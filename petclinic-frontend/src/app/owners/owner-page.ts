import { components } from '../generated/api-types';

export type OwnerRow = components['schemas']['OwnerRowDto'];

export interface OwnerPage {
  content: OwnerRow[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface OwnerQuery {
  page?: number;
  size?: number;
  sort?: string;
  lastName?: string;
}
