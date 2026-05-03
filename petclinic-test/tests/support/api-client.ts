import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

export interface OwnerPageDto {
  content: OwnerDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface OwnerQuery {
  query?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  async fetchOwnerPage({
    query,
    page = 0,
    size = 10,
    sort = 'name,asc'
  }: OwnerQuery = {}): Promise<OwnerPageDto> {
    const response = await this.client.get<OwnerPageDto>('/owners', {
      params: {
        page,
        size,
        sort,
        ...(query ? { query } : {})
      }
    });

    return response.data;
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
}
