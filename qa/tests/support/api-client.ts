import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

export interface OwnerFieldsDto {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  async fetchOwners(): Promise<OwnerDto[]> {
    const response = await this.client.get<PageResponse<OwnerDto>>('/owners', {
      params: { size: 10000 }
    });
    return response.data.content;
  }

  async fetchOwnersPage(page = 0, size = 10): Promise<OwnerDto[]> {
    const response = await this.client.get<PageResponse<OwnerDto>>('/owners', {
      params: { page, size }
    });
    return response.data.content;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const response = await this.client.get<PageResponse<OwnerDto>>('/owners', {
      params: { q: prefix, size: 10000 }
    });
    return response.data.content;
  }

  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.firstName} ${owner.lastName}`.trim())
      .filter(name => name.length > 0);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static extractLastName(fullName: string): string {
    const firstSpace = fullName.indexOf(' ');
    if (firstSpace < 0 || firstSpace === fullName.length - 1) {
      return fullName;
    }
    return fullName.substring(firstSpace + 1);
  }

  async createOwner(owner: OwnerFieldsDto): Promise<number> {
    const response = await this.client.post('/owners', owner);
    const location: string = response.headers['location'];
    return parseInt(location.split('/').pop()!);
  }

  async updateOwner(id: number, owner: OwnerFieldsDto): Promise<void> {
    await this.client.put(`/owners/${id}`, owner);
  }

  async deleteOwner(id: number): Promise<void> {
    await this.client.delete(`/owners/${id}`);
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
