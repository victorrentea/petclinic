import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export type OwnerSort = 'name,asc' | 'name,desc' | 'city,asc' | 'city,desc';

/**
 * Every owner the API knows, in the given order. GET /api/owners answers one page at a time
 * (`{content, totalElements}`), so a test looking for a seeded owner must walk the pages:
 * owners other specs leave behind can push it off the first one.
 */
export async function fetchAllOwners(sort: OwnerSort = 'name,asc'): Promise<any[]> {
  const owners: any[] = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {page, size: 20, sort}, timeout: 10_000});
    if (!Array.isArray(data?.content)) {
      throw new Error(`GET /api/owners did not answer a page: ${JSON.stringify(data).slice(0, 200)}`);
    }
    owners.push(...data.content);
    if (data.content.length === 0 || owners.length >= data.totalElements) {
      return owners;
    }
  }
}
