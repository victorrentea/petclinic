import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

/** Mirrors the backend `OwnerPageDto` returned by `GET /api/owners`. */
export interface OwnerPageDto {
  content: OwnerDto[];
  totalElements: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface OwnerListParams {
  page?: number;
  size?: number;
  /** Grid column + direction, e.g. `name,asc` or `city,desc`. */
  sort?: string;
  lastName?: string;
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

  async fetchOwnersPage(params: OwnerListParams = {}): Promise<OwnerPageDto> {
    const response = await this.client.get<OwnerPageDto>('/owners', { params });
    return response.data;
  }

  /** The default page the grid shows on load / after search: page 0, size 10, sorted by name asc. */
  async fetchFirstPage(lastName?: string): Promise<OwnerPageDto> {
    return this.fetchOwnersPage({ page: 0, size: 10, sort: 'name,asc', lastName });
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  /** The grid renders the Name column as "Last, First". */
  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.lastName}, ${owner.firstName}`.trim())
      .filter(name => name.length > 0);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Extracts the last name from a "Last, First" grid cell. */
  static extractLastName(fullName: string): string {
    const comma = fullName.indexOf(',');
    return comma < 0 ? fullName.trim() : fullName.substring(0, comma).trim();
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
