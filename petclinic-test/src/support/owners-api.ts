import axios from 'axios';

// The owners listing is paged server-side (the clinic is heading for ~100.000 owners),
// so *no* request answers with the whole table any more. Everything in the suite that
// used to read the array off `GET /api/owners` comes through here instead: one place
// that knows the page shape, and one place that knows how to walk it.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

/** The largest size the endpoint's whitelist accepts — walking uses it to page as few times as possible. */
const MAX_PAGE_SIZE = 20;

export interface PetRow {
  id: number;
  name: string;
  birthDate?: string;
}

export interface OwnerRow {
  id: number;
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  telephone?: string;
  pets?: PetRow[];
}

/** Spring's `PagedModel` shape: `{content, page:{size, number, totalElements, totalPages}}`. */
export interface OwnersPage {
  content: OwnerRow[];
  page: {size: number; number: number; totalElements: number; totalPages: number};
}

export interface OwnersQuery {
  page?: number;
  size?: number;
  sort?: string;
  lastName?: string;
}

export async function fetchOwnersPage(params: OwnersQuery = {}): Promise<OwnersPage> {
  const {data} = await axios.get<OwnersPage>(`${API_BASE}/owners`, {params, timeout: 10_000});
  if (!data || !Array.isArray(data.content) || !data.page) {
    throw new Error('GET /owners did not answer a page {content, page:{...}} — '
        + `got ${JSON.stringify(data).slice(0, 200)}. Is the backend up and the DB seeded by Flyway?`);
  }
  return data;
}

/**
 * Every owner the clinic holds, gathered page by page, plus the total the server reports.
 * A step that wants them all has to walk: asking for one big page is exactly what the
 * size whitelist refuses.
 */
export async function fetchAllOwners(): Promise<{owners: OwnerRow[]; total: number}> {
  const owners: OwnerRow[] = [];
  let total = 0;
  for (let number = 0, totalPages = 1; number < totalPages; number++) {
    const page = await fetchOwnersPage({page: number, size: MAX_PAGE_SIZE});
    owners.push(...page.content);
    totalPages = page.page.totalPages;
    total = page.page.totalElements;
  }
  if (owners.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  return {owners, total};
}

/** The first owner matching `matches`, in default page order; stops walking as soon as one is found. */
export async function findOwner(matches: (owner: OwnerRow) => boolean): Promise<OwnerRow | undefined> {
  for (let number = 0, totalPages = 1; number < totalPages; number++) {
    const page = await fetchOwnersPage({page: number, size: MAX_PAGE_SIZE});
    const hit = page.content.find(matches);
    if (hit) {
      return hit;
    }
    totalPages = page.page.totalPages;
  }
  return undefined;
}

export function petsOf(owner: OwnerRow): PetRow[] {
  return owner.pets ?? [];
}
