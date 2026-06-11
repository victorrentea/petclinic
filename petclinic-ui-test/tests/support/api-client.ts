import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
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

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  // The owners endpoint is paginated (PagedModel envelope): rows under `content`, default size 10.
  async fetchOwners(): Promise<OwnerDto[]> {
    const response = await this.client.get('/owners', {
      params: { page: 0, size: 10, sort: 'name,asc' }
    });
    return response.data.content ?? [];
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const response = await this.client.get('/owners', {
      params: { lastName: prefix, page: 0, size: 10, sort: 'name,asc' }
    });
    return response.data.content ?? [];
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  // The UI renders owner names as "lastName, firstName" (matches the Name sort order).
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

  // Names render as "lastName, firstName" — the last name is the part before the comma.
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
