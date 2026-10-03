import axios from 'axios';

// GET /api/owners answers one page at a time ({content, totalElements}); these walk the pages.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const PAGE_SIZE = 20;

export interface OwnerJson {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  pets: any[];
}

async function fetchOwnerPage(page: number, sort: string): Promise<{content: OwnerJson[]; totalElements: number}> {
  const {data} = await axios.get(`${API_BASE}/owners`, {params: {page, size: PAGE_SIZE, sort}, timeout: 10_000});
  return data;
}

/** Every owner, in `sort` order; throws if a page repeats an owner or the pages fall short of the total. */
export async function fetchAllOwners(sort = 'name,asc'): Promise<OwnerJson[]> {
  const owners: OwnerJson[] = [];
  for (let page = 0; ; page++) {
    const {content, totalElements} = await fetchOwnerPage(page, sort);
    owners.push(...content);
    if (content.length === 0 || owners.length >= totalElements) {
      if (owners.length !== totalElements || new Set(owners.map((o) => o.id)).size !== owners.length) {
        throw new Error(`Paging returned ${owners.length} owners (${new Set(owners.map((o) => o.id)).size} distinct)`
          + ` for a total of ${totalElements}`);
      }
      return owners;
    }
  }
}

/** The first owner, in name order, that matches — reading no more pages than it takes to find them. */
export async function findOwner(matches: (owner: OwnerJson) => boolean): Promise<OwnerJson | undefined> {
  for (let page = 0; ; page++) {
    const {content} = await fetchOwnerPage(page, 'name,asc');
    const found = content.find(matches);
    if (found || content.length < PAGE_SIZE) {
      return found;
    }
  }
}
