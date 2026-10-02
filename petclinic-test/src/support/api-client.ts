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
  pets: {id: number; name: string; birthDate: string}[];
}

export interface OwnerPage {
  content: OwnerDto[];
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

  async fetchOwnerPage(params: {lastName?: string; page?: number; size?: number; sort?: string}): Promise<OwnerPage> {
    const {data} = await this.client.get<OwnerPage>('/owners', {params});
    if (!Array.isArray(data?.content)) {
      throw new Error(`GET /api/owners did not answer a page: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return data;
  }

  /** Every owner, walked page by page in Name order: GET /api/owners answers one page at a time. */
  async fetchEveryOwner(): Promise<OwnerDto[]> {
    const owners: OwnerDto[] = [];
    for (let page = 0; ; page++) {
      const answer = await this.fetchOwnerPage({page, size: 20});
      owners.push(...answer.content);
      if (answer.content.length === 0 || owners.length >= answer.totalElements) {
        return owners;
      }
    }
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
