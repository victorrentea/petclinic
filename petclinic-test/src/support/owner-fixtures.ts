import axios from 'axios';
import {expect} from '@playwright/test';

export interface OwnerFixture {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  pets: {id: number; name: string; birthDate: string}[];
}

export type OwnerSort = 'name,asc' | 'name,desc' | 'city,asc' | 'city,desc';

export interface OwnerPage {
  content: OwnerFixture[];
  totalElements: number;
}

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';

export async function fetchOwnerPage(
  page = 0, size = 10, sort: OwnerSort = 'name,asc', lastName = '',
): Promise<OwnerPage> {
  const {data} = await axios.get<OwnerPage>(`${API_BASE}/owners`, {
    params: {page, size, sort, lastName},
    timeout: 10_000,
  });
  expect(Object.keys(data).sort()).toEqual(['content', 'totalElements']);
  expect(Array.isArray(data.content)).toBe(true);
  expect(Number.isSafeInteger(data.totalElements)).toBe(true);
  expect(data.totalElements).toBeGreaterThanOrEqual(0);
  expect(data.content.length).toBeLessThanOrEqual(size);
  return data;
}

export async function fetchAllOwners(sort: OwnerSort = 'name,asc', lastName = ''): Promise<OwnerFixture[]> {
  const first = await fetchOwnerPage(0, 20, sort, lastName);
  const owners = [...first.content];
  for (let page = 1; page * 20 < first.totalElements; page++) {
    const next = await fetchOwnerPage(page, 20, sort, lastName);
    expect(next.totalElements, 'fixture dataset must stay unchanged during traversal').toBe(first.totalElements);
    owners.push(...next.content);
  }
  expect(owners).toHaveLength(first.totalElements);
  expect(new Set(owners.map(owner => owner.id)).size, 'API pages must not repeat owner IDs').toBe(first.totalElements);
  return owners;
}
