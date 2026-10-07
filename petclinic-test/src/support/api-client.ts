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

export interface OwnerSummary {
  id: number;
  firstName: string;
  lastName: string;
  pets: {id: number}[];
}

export interface OwnerPage {
  content: OwnerSummary[];
  totalElements: number;
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

  async fetchOwnersPage(query: string): Promise<OwnerPage> {
    const response = await this.client.get<OwnerPage>(`/owners?${query}`);
    return response.data;
  }

  async fetchOwner(ownerId: number): Promise<OwnerSummary> {
    const response = await this.client.get<OwnerSummary>(`/owners/${ownerId}`);
    return response.data;
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
