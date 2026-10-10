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

export interface VisitPageDto {
  content: VisitDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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

  async fetchVisitsPage(params: {page?: number; size?: number; sort?: string} = {}): Promise<VisitPageDto> {
    const response = await this.client.get<VisitPageDto>('/visits', {params});
    return response.data;
  }
}
