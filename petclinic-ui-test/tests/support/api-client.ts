import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

export interface OwnersPage {
  content: OwnerDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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

const LARGE_PAGE_SIZE = 1000;

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  async fetchOwners(): Promise<OwnerDto[]> {
    const response = await this.client.get<OwnersPage>('/owners', {
      params: { size: LARGE_PAGE_SIZE }
    });
    return response.data.content;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const response = await this.client.get<OwnersPage>('/owners', {
      params: { lastName: prefix, size: LARGE_PAGE_SIZE }
    });
    return response.data.content;
  }

  async fetchOwnersPage(params: {
    lastName?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<OwnersPage> {
    const response = await this.client.get<OwnersPage>('/owners', { params });
    return response.data;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.lastName}, ${owner.firstName}`.trim())
      .filter(name => name.length > 0 && name !== ',');
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  static extractLastName(fullName: string): string {
    const commaIdx = fullName.indexOf(',');
    if (commaIdx > 0) {
      return fullName.substring(0, commaIdx).trim();
    }
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
