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

export interface PetDto {
  id: number;
  name: string;
  birthDate: string;
}

export interface OwnerDto {
  id: number;
  firstName: string;
  lastName: string;
  pets: PetDto[];
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

  /** GET /api/owners is paged: walks it 20 owners at a time, from the first page to the last. */
  async *ownerPages(sort = 'name,asc'): AsyncGenerator<OwnerPage> {
    for (let page = 0, seen = 0; ; page++) {
      const {data} = await this.client.get<OwnerPage>('/owners', {params: {page, size: 20, sort}});
      yield data;
      seen += data.content.length;
      if (data.content.length === 0 || seen >= data.totalElements) {
        return;
      }
    }
  }

  async findOwner(matches: (owner: OwnerDto) => boolean): Promise<OwnerDto | undefined> {
    for await (const {content} of this.ownerPages()) {
      const owner = content.find(matches);
      if (owner) {
        return owner;
      }
    }
    return undefined;
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
