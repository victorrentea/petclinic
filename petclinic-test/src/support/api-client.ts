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

  /** @returns the new owner's id */
  async createOwner(firstName: string, lastName: string): Promise<number> {
    const response = await this.client.post('/owners',
      {firstName, lastName, address: '1 Test Street', city: 'Testville', telephone: '6085551023'});
    return idFromLocation(response.headers.location);
  }

  /** @returns the new pet's id */
  async createPet(ownerId: number, name: string): Promise<number> {
    const response = await this.client.post(`/owners/${ownerId}/pets`,
      {name, birthDate: '2020-01-01', type: {id: 2, name: 'dog'}});
    return idFromLocation(response.headers.location);
  }

  async createVisit(ownerId: number, petId: number, date: string, description: string): Promise<void> {
    await this.client.post(`/owners/${ownerId}/pets/${petId}/visits`, {date, description});
  }

  static sortedByDate<T extends {date: string}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
}

/** POSTs answer 201 with an empty body: the new id is only in `Location`, e.g. /api/pets/34 */
function idFromLocation(location: string): number {
  return Number(location.split('/').pop());
}
