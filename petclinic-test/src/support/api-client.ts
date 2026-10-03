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

/** The first owner that matches, read a page at a time: GET /owners never answers with everyone. */
export async function findOwner(apiBase: string, matches: (owner: any) => boolean): Promise<any | undefined> {
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${apiBase}/owners`, {params: {page, size: 20}, timeout: 10_000});
    const owner = data.content.find(matches);
    if (owner || data.content.length === 0) {
      return owner;
    }
  }
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

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
