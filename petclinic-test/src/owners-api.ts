import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

/** The endpoint's own hard cap, so walking the pages takes as few calls as it can. */
export const MAX_PAGE_SIZE = 20;

export interface OwnerRow {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
}

/** Every owner the clinic holds, walked page by page — the list endpoint is paged. */
export async function allOwnerRows(): Promise<OwnerRow[]> {
  const rows: OwnerRow[] = [];
  let totalPages = 1;
  for (let page = 0; page < totalPages; page++) {
    const {data} = await axios.get(`${API_BASE}/owners`, {
      params: {page, size: MAX_PAGE_SIZE},
      timeout: 10_000,
    });
    totalPages = data?.page?.totalPages ?? 0;
    rows.push(...(data?.content ?? []));
  }
  return rows;
}

/**
 * The first owner who has at least one pet.
 * <p>
 * Two calls rather than one: the grid's rows carry no pets (they page over the whole table),
 * so the pets come from the owner's detail endpoint.
 */
export async function firstOwnerWithAPet(): Promise<any> {
  for (const row of await allOwnerRows()) {
    const {data: owner} = await axios.get(`${API_BASE}/owners/${row.id}`, {timeout: 10_000});
    if (Array.isArray(owner.pets) && owner.pets.length > 0) {
      return owner;
    }
  }
  throw new Error('No owner with a pet — is the backend up and the DB seeded by Flyway?');
}
