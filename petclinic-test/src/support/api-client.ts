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

export interface OwnerName {
  firstName: string;
  lastName: string;
}

export interface OwnerPage {
  content: (OwnerName & {id: number; city: string})[];
  totalElements: number;
}

export interface PetDto {
  id: number;
  ownerId?: number;
}

/** How the UI writes an owner's name (the frontend's `ownerName` pipe): last name first. */
export const ownerName = (o: OwnerName) => `${o.lastName}, ${o.firstName}`;

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

  async fetchOwnersPage(params: {lastName?: string; size?: number} = {}): Promise<OwnerPage> {
    const response = await this.client.get<OwnerPage>('/owners', {params});
    return response.data;
  }

  async fetchPets(): Promise<PetDto[]> {
    const response = await this.client.get<PetDto[]>('/pets');
    return response.data;
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}
