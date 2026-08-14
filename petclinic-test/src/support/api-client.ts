import axios, {AxiosInstance} from 'axios';

// Use 127.0.0.1 (not "localhost"): under Node 18+ "localhost" can resolve to IPv6 ::1
// first and fail with a cryptic AggregateError when the backend listens on IPv4.
export const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';

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

export interface PetDto {
  id: number;
  name: string;
  birthDate?: string;
}

export interface OwnerDto {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  petCount: number;
  pets?: PetDto[];
}

/**
 * GET /api/owners returns a slice, never the whole table: `size` is clamped
 * server-side to one of 5 / 10 / 20, so there is no "give me all owners" request.
 */
export interface OwnerPage {
  content: OwnerDto[];
  totalElements: number;
  number: number;
  size: number;
}

export const MAX_PAGE_SIZE = 20;

export interface OwnerQuery {
  lastName?: string;
  page?: number;
  size?: number;
  /** One of the public sort names — `name`, `city` or `petCount` — plus a direction. */
  sort?: string;
}

export const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;

export async function fetchOwnerPage(query: OwnerQuery = {}): Promise<OwnerPage> {
  const {data} = await axios.get<OwnerPage>(`${API_BASE}/owners`, {params: query, timeout: 10_000});
  if (!data || !Array.isArray(data.content) || typeof data.totalElements !== 'number') {
    throw new Error(
      `GET /api/owners did not answer with a page object {content, totalElements, number, size}: ` +
      JSON.stringify(data).slice(0, 200)
    );
  }
  return data;
}

/** Walks every page — the only way to see all owners now that one request returns at most 20. */
export async function fetchAllOwners(query: Omit<OwnerQuery, 'page' | 'size'> = {}): Promise<OwnerDto[]> {
  const owners: OwnerDto[] = [];
  for (let page = 0; ; page++) {
    const slice = await fetchOwnerPage({...query, page, size: MAX_PAGE_SIZE});
    owners.push(...slice.content);
    if (slice.content.length === 0 || owners.length >= slice.totalElements) {
      return owners;
    }
  }
}

/**
 * An owner holding a pet the caller cares about. Asking for the pet-richest owners
 * first keeps every pet-owning owner on the first page, so no caller has to know
 * which page an owner happens to land on once the list is sorted by name.
 */
export async function anOwnerWhosePetsMatch(
  wanted: (pet: PetDto) => boolean
): Promise<{owner: OwnerDto; pet: PetDto}> {
  const {content} = await fetchOwnerPage({sort: 'petCount,desc', size: MAX_PAGE_SIZE});
  for (const owner of content) {
    const pet = (owner.pets ?? []).find(wanted);
    if (pet) {
      return {owner, pet};
    }
  }
  throw new Error(
    `No owner with a matching pet among the ${content.length} pet-richest owners — is the DB seeded?`
  );
}

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = API_BASE) {
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
