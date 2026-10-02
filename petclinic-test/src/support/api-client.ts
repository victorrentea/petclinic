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

export interface OwnerDto {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  pets: {id: number; name: string; birthDate: string}[];
}

export interface OwnerPage {
  content: OwnerDto[];
  totalElements: number;
}

/**
 * Every owner, walked page by page in Name order — GET /api/owners answers one page at a
 * time (#25). Fails on a duplicate or a missing owner, so a broken paging shows up here
 * instead of as an owner some scenario cannot find.
 */
export async function fetchAllOwners(apiBase: string): Promise<OwnerDto[]> {
  const owners: OwnerDto[] = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get<OwnerPage>(`${apiBase}/owners`, {params: {page, size: 20}, timeout: 10_000});
    if (!Array.isArray(data?.content)) {
      throw new Error('GET /owners did not answer with a page — is the backend from before #25?');
    }
    owners.push(...data.content);
    if (data.content.length === 0 || owners.length >= data.totalElements) {
      const ids = new Set(owners.map((o) => o.id));
      if (ids.size !== owners.length || owners.length !== data.totalElements) {
        throw new Error(
          `Paging returned ${ids.size} distinct of ${owners.length} owners, total ${data.totalElements}`);
      }
      return owners;
    }
  }
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
