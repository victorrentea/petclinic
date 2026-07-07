import { components } from '../generated/api-types';
import { Pet } from '../pets/pet';

export type Owner = Omit<components['schemas']['OwnerDto'], 'id' | 'pets'> & {
  id: number;
  pets: Pet[];
};

export type OwnerListSortField = 'name' | 'city';
export type SortDirection = 'asc' | 'desc';
export type OwnerSort = Omit<components['schemas']['OwnerSortDto'], 'field' | 'direction'> & {
  field: OwnerListSortField;
  direction: SortDirection;
};

export interface OwnerListQuery {
  lastName?: string;
  page?: number;
  pageSize?: number;
  sort?: OwnerListSortField;
  direction?: SortDirection;
}

export type OwnersPage = Omit<
  components['schemas']['OwnersPageDto'],
  'items' | 'lastName' | 'page' | 'pageSize' | 'sort' | 'totalItems' | 'totalPages'
> & {
  items: Owner[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  lastName: string;
  sort: OwnerSort;
};
