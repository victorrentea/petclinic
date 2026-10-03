import axios from 'axios';
import {expect} from '@playwright/test';

// GET /api/owners answers one page at a time ({content, totalElements}); these walk it.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface OwnerRow {
  id: number;
  firstName: string;
  lastName: string;
  pets: any[];
}

export interface OwnerPage {
  content: OwnerRow[];
  totalElements: number;
}

export async function ownerPage(params: Record<string, string | number> = {}): Promise<OwnerPage> {
  const {data} = await axios.get(`${API_BASE}/owners`, {params, timeout: 10_000});
  if (!Array.isArray(data?.content) || typeof data.totalElements !== 'number') {
    throw new Error(`Expected a page of owners, got: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

/** The first owner matching, reading no further pages than needed to find it. */
export async function findOwner(matches: (owner: OwnerRow) => boolean): Promise<OwnerRow | undefined> {
  for (let page = 0; ; page++) {
    const {content} = await ownerPage(page === 0 ? {} : {page});
    const found = content.find(matches);
    if (found || content.length === 0) {
      return found;
    }
  }
}

/** Every owner, walking the pages in name order — and checking none was skipped or repeated. */
export async function everyOwnerByName(): Promise<OwnerRow[]> {
  const owners: OwnerRow[] = [];
  for (let page = 0; ; page++) {
    const {content, totalElements} = await ownerPage({page, size: 20, sort: 'name,asc'});
    owners.push(...content);
    if (content.length === 0 || owners.length >= totalElements) {
      expect(owners).toHaveLength(totalElements);
      expect(new Set(owners.map((o) => o.id)).size).toBe(totalElements);
      return owners;
    }
  }
}
