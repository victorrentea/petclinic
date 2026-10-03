import axios from 'axios';

// GET /api/owners answers one page at a time ({content, totalElements}), never the whole list.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface OwnerPage {
  content: any[];
  totalElements: number;
}

export async function ownersPage(page: number, size: number, sort = 'name,asc'): Promise<OwnerPage> {
  const {data} = await axios.get(`${API_BASE}/owners`, {params: {page, size, sort}, timeout: 10_000});
  if (!Array.isArray(data?.content) || typeof data.totalElements !== 'number') {
    throw new Error(`The API did not answer with a page of owners: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

/** Every owner, in name order, collected page by page. */
export async function everyOwner(): Promise<any[]> {
  const owners: any[] = [];
  for (let page = 0; ; page++) {
    const {content, totalElements} = await ownersPage(page, 20);
    owners.push(...content);
    if (content.length === 0 || owners.length >= totalElements) {
      return owners;
    }
  }
}

/** The first owner, in name order, that matches — reading only as many pages as it takes. */
export async function findOwner(matches: (owner: any) => boolean): Promise<any | undefined> {
  for (let page = 0; ; page++) {
    const {content} = await ownersPage(page, 20);
    const found = content.find(matches);
    if (found || content.length === 0) {
      return found;
    }
  }
}
