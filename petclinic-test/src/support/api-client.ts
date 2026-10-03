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

export interface OwnerPageParams {
  lastName?: string;
  page?: number;
  size?: 5 | 10 | 20;
  sort?: 'name,asc' | 'name,desc' | 'city,asc' | 'city,desc';
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

  async fetchOwnerPage(params: OwnerPageParams = {}): Promise<OwnerPage> {
    const response = await this.client.get<OwnerPage>('/owners', {params});
    return response.data;
  }

  /** The first owner, in name order, that `wanted` accepts — reading only as many pages as that takes. */
  async findOwner(wanted: (owner: OwnerDto) => boolean): Promise<OwnerDto | undefined> {
    for (let page = 0; ; page++) {
      const {content} = await this.fetchOwnerPage({page, size: 20});
      if (content.length === 0) {
        return undefined;
      }
      const found = content.find(wanted);
      if (found) {
        return found;
      }
    }
  }

  /** Every owner, a page at a time: the list endpoint never answers more than 20. */
  async fetchAllOwners(sort: OwnerPageParams['sort'] = 'name,asc'): Promise<OwnerDto[]> {
    const owners: OwnerDto[] = [];
    for (let page = 0; ; page++) {
      const {content, totalElements} = await this.fetchOwnerPage({page, size: 20, sort});
      owners.push(...content);
      if (content.length === 0 || owners.length >= totalElements) {
        return owners;
      }
    }
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
