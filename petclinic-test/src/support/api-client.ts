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

/** A row of `GET /owners`: only what the owners grid shows. */
export interface OwnerRowDto {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  petNames: string[];
}

export interface OwnerPageDto {
  content: OwnerRowDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface OwnerListQuery {
  lastName?: string;
  page?: number;
  size?: 5 | 10 | 20;
  sort?: 'name' | 'city';
  direction?: 'asc' | 'desc';
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

  async fetchOwnerPage(query: OwnerListQuery = {}): Promise<OwnerPageDto> {
    const {data} = await this.client.get<OwnerPageDto>('/owners', {params: query});
    if (!Array.isArray(data?.content)) {
      const got = JSON.stringify(data).slice(0, 200);
      throw new Error(`GET /owners should return a page {content, totalPages, ...}, got: ${got}`);
    }
    return data;
  }

  /** Every owner matching the query, walking the pages at the largest size the API allows. */
  async fetchAllOwners(query: Omit<OwnerListQuery, 'page' | 'size'> = {}): Promise<OwnerRowDto[]> {
    const owners: OwnerRowDto[] = [];
    let totalPages = 1;
    for (let page = 0; page < totalPages; page++) {
      const ownerPage = await this.fetchOwnerPage({...query, page, size: 20});
      owners.push(...ownerPage.content);
      totalPages = ownerPage.totalPages;
    }
    return owners;
  }

  async fetchOwnerPetIds(ownerId: number): Promise<number[]> {
    const {data} = await this.client.get<{pets: {id: number}[]}>(`/owners/${ownerId}`);
    return data.pets.map((pet) => pet.id);
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
