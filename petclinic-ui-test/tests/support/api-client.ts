import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

export interface OwnerPage {
  content: OwnerDto[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
}

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

  // GET /api/owners now returns a Spring page envelope { content, page: {...} },
  // not a bare array. `size` is capped server-side at 20 (the seed dataset is tiny).
  async fetchOwners(): Promise<OwnerDto[]> {
    const page = await this.fetchOwnersPage({ size: 20 });
    return page.content;
  }

  // Mirrors exactly the page the UI shows for a prefix search: the default first page
  // (size 10, sort name asc). Must match the UI's page size or the row-count assertions
  // diverge when a prefix matches more than one page of owners.
  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const page = await this.fetchOwnersPage({ lastName: prefix, page: 0, size: 10, sort: 'name', direction: 'asc' });
    return page.content;
  }

  // Raw page fetch — lets e2e assert server-driven order/paging against the same params the UI uses.
  async fetchOwnersPage(params: {
    lastName?: string; page?: number; size?: number; sort?: string; direction?: string;
  } = {}): Promise<OwnerPage> {
    const response = await this.client.get<OwnerPage>('/owners', { params });
    return response.data;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  // The Owners grid renders the name first-name-first ("George Franklin"), as the legacy grid did.
  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.firstName} ${owner.lastName}`.trim())
      .filter(name => name.length > 0);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  // First-name-first display: "George Franklin" → "Franklin" (last whitespace-delimited token).
  static extractLastName(fullName: string): string {
    const tokens = fullName.trim().split(/\s+/);
    return tokens[tokens.length - 1] ?? '';
  }

  static choosePrefixFrom(owners: OwnerDto[]): string {
    for (const owner of owners) {
      if (owner.lastName && owner.lastName.trim()) {
        const lastName = owner.lastName.trim();
        return lastName.substring(0, Math.min(2, lastName.length));
      }
    }
    throw new Error('No owners available to derive search prefix');
  }
}
