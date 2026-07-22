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
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface OwnerPageParams {
  lastName?: string;
  page?: number;
  size?: number;
  sort?: string;
}

/** The backend clamps page size to 20; asking for more silently yields 20. */
export const MAX_PAGE_SIZE = 20;

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

  /** The endpoint is paged, so walk every page when the whole set is needed. */
  async fetchOwners(): Promise<OwnerDto[]> {
    return this.fetchAllPages({});
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    return this.fetchAllPages({ lastName: prefix });
  }

  /** One page exactly as the grid would request it. */
  async fetchOwnerPage(params: OwnerPageParams): Promise<OwnerPage> {
    const response = await this.client.get<OwnerPage>('/owners', { params });
    return response.data;
  }

  private async fetchAllPages(params: OwnerPageParams): Promise<OwnerDto[]> {
    const owners: OwnerDto[] = [];
    let page = 0;
    let totalPages = 1;
    do {
      const body = await this.fetchOwnerPage({ ...params, page, size: MAX_PAGE_SIZE });
      owners.push(...body.content);
      totalPages = body.totalPages;
      page++;
    } while (page < totalPages);
    return owners;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  /** The grid renders "Last, First" — it sorts by last name, so the eye must see it first. */
  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.lastName}, ${owner.firstName}`.trim())
      .filter(name => name.length > 2);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Cells read "Last, First", so the last name is everything before the comma. */
  static extractLastName(fullName: string): string {
    const comma = fullName.indexOf(',');
    return comma < 0 ? fullName : fullName.substring(0, comma).trim();
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
