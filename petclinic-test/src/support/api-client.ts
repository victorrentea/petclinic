import axios, {AxiosInstance} from 'axios';

export interface VisitDto {
  id: number;
  date: string;
  description: string;
  petId: number;
  petName?: string;
  ownerId?: number;
  ownerFirstName?: string;
  ownerLastName?: string;
}

/** The envelope `GET /api/owners` answers with since the owners grid became paged. */
export interface PageEnvelope<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface OwnerSummary {
  id: number;
  firstName: string;
  lastName: string;
  pets?: {id: number}[];
}

// One page big enough to hold the whole clinic. Not a guess to live with: if the server
// ever hands back fewer rows than it counted, fetchAllOwners() says so instead of letting
// a fixture search a truncated list.
const EVERY_OWNER = 1_000;

/**
 * Every owner the clinic holds — which is *not* what `GET /api/owners` answers by default
 * any more: it pages, 10 rows at a time, ordered by name ascending.
 *
 * The fixtures below reason about the whole clinic ("the first owner that has a pet", "the
 * last owner" — see AGENTS.md), so reading `content` off the default page would quietly
 * shrink their search to the first ten. Worse, name-ascending page 1 is exactly where
 * add-owner.spec.ts's deliberately-left-behind `Acceptance*` owners pile up, none of which
 * has a pet.
 */
export async function fetchAllOwners(apiBase: string): Promise<OwnerSummary[]> {
  const {data} = await axios.get<PageEnvelope<OwnerSummary>>(`${apiBase}/owners`,
    {params: {size: EVERY_OWNER}, timeout: 10_000});

  if (!data || !Array.isArray(data.content)) {
    throw new Error(`GET ${apiBase}/owners did not answer a page envelope ` +
      `({content, totalElements, totalPages, number, size}); got: ${JSON.stringify(data).slice(0, 200)}`);
  }
  if (data.content.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  if (data.content.length < data.totalElements) {
    throw new Error(`Asked for ${EVERY_OWNER} owners in one page and got ${data.content.length} ` +
      `of ${data.totalElements} — the endpoint caps the page size, so this fixture is ` +
      `searching a truncated list. Walk the pages instead.`);
  }
  return data.content;
}

export class ApiClient {
  private client: AxiosInstance;

  // Use 127.0.0.1 (not "localhost"): under Node 18+ "localhost" can resolve to IPv6 ::1
  // first and fail with a cryptic AggregateError when the backend listens on IPv4.
  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
