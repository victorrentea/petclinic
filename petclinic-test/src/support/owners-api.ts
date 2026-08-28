import axios from 'axios';

/**
 * `GET /api/owners` returns a Spring `Page<OwnerDto>` since owners became paged, so
 * nothing may assume the response is an array any more, and nothing may assume one
 * request sees every owner: the endpoint defaults to page 0, size 10.
 */
export interface OwnerRow {
  id: number;
  firstName: string;
  lastName: string;
  city?: string;
  pets?: any[];
}

interface OwnerPageResponse {
  content: OwnerRow[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last?: boolean;
}

// Use 127.0.0.1 (not "localhost"): under Node 18+ "localhost" can resolve to IPv6 ::1
// first and fail with a cryptic AggregateError when the backend listens on IPv4.
const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';

// One request per this many owners. Large enough that the seeded clinic arrives in a
// single call, small enough that the (deliberate) pets/visits N+1 stays survivable.
const FETCH_PAGE_SIZE = 200;
const MAX_PAGES = 100;

/** The clinic's owners, the way the grid and the search box show them: `Potter, Harry`. */
export const fullName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;

/** Walks every page of `GET /api/owners` so callers see the whole clinic, not the first 10. */
export async function fetchAllOwners(): Promise<OwnerRow[]> {
  const all: OwnerRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const {data} = await axios.get<OwnerPageResponse>(`${API_BASE}/owners`, {
      params: {page, size: FETCH_PAGE_SIZE},
      timeout: 30_000,
    });
    if (!data || !Array.isArray(data.content)) {
      throw new Error(`Expected a page of owners with a "content" array, got: ${JSON.stringify(data)}`);
    }
    all.push(...data.content);
    if (data.content.length === 0 || page + 1 >= data.totalPages) {
      return all;
    }
  }
  throw new Error(`Gave up after ${MAX_PAGES} pages of owners — is the endpoint paging at all?`);
}
