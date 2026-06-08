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

export interface OwnerPageQuery {
  page?: number;
  size?: number;
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

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  // Listing returns a Spring Data Page envelope; backend caps size at 20.
  async fetchOwnerPage(query: OwnerPageQuery = {}): Promise<OwnerPage> {
    const response = await this.client.get<OwnerPage>('/owners', { params: query });
    return response.data;
  }

  async fetchOwners(): Promise<OwnerDto[]> {
    const page = await this.fetchOwnerPage({ page: 0, size: 20, sort: 'name,asc' });
    return page.content;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const page = await this.fetchOwnerPage({ page: 0, size: 20, sort: 'name,asc', lastName: prefix });
    return page.content;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.firstName} ${owner.lastName}`.trim())
      .filter(name => name.length > 0);
  }

  // The UI renders the Name column last-name-first ("Franklin George") to match the sort key.
  static getFullNamesLastFirst(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.lastName} ${owner.firstName}`.trim())
      .filter(name => name.length > 0);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  static extractLastName(fullName: string): string {
    const firstSpace = fullName.indexOf(' ');
    if (firstSpace < 0 || firstSpace === fullName.length - 1) {
      return fullName;
    }
    return fullName.substring(firstSpace + 1);
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
