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

export interface OwnerPageDto {
  content: {firstName: string; lastName: string}[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** Query of GET /owners; `page` counts from 0, as the API does. */
export interface OwnerPageQuery {
  lastName?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;

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

  async fetchOwnerPage(query: OwnerPageQuery = {}): Promise<OwnerPageDto> {
    const response = await this.client.get<OwnerPageDto>('/owners', {params: query});
    return response.data;
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
