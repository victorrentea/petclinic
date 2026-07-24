import axios, { AxiosInstance } from 'axios';

export interface PetDto {
  id: number;
  name: string;
}

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
  pets?: PetDto[];
}

/**
 * Flat page envelope now returned by `GET /api/owners` (`PageDto<OwnerDto>`).
 * The endpoint no longer returns a bare array — this is a breaking contract change.
 */
export interface OwnerPageDto {
  content: OwnerDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface OwnerPageQuery {
  lastName?: string;
  page?: number;
  size?: number;
  /** e.g. `lastName,asc` or `city,desc`. Only lastName and city are sortable. */
  sort?: string;
}

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

/** Server default page size (`spring.data.web.pageable.default-page-size`) and the UI default. */
export const DEFAULT_PAGE_SIZE = 10;

/** What the grid sends on a bare `/owners`; stated explicitly so a test never guesses the order. */
export const DEFAULT_SORT = 'lastName,asc';

/**
 * Server cap (`spring.data.web.pageable.max-page-size`). Asking for more is silently
 * clamped to this, so "give me everything" is never a single request any more.
 */
export const MAX_PAGE_SIZE = 20;

/** Safety net so a mis-reported `totalPages` can never spin forever. */
const MAX_PAGES_TO_WALK = 100;

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

  /** One page, exactly as the grid would request it. Unwrap `.content` for the rows. */
  async fetchOwnerPage(query: OwnerPageQuery = {}): Promise<OwnerPageDto> {
    const response = await this.client.get<OwnerPageDto>('/owners', { params: query });
    return response.data;
  }

  /**
   * Every owner — deliberately several requests, one per page of {@link MAX_PAGE_SIZE}.
   * Only use this when a test genuinely needs the whole set; the grid never does.
   */
  async fetchAllOwners(): Promise<OwnerDto[]> {
    return this.walkAllPages({});
  }

  /** Every owner whose last name starts with `prefix`, walking all pages of the filtered set. */
  async fetchAllOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    return this.walkAllPages({ lastName: prefix });
  }

  private async walkAllPages(query: OwnerPageQuery): Promise<OwnerDto[]> {
    const owners: OwnerDto[] = [];
    let page = 0;
    let totalPages = 1;
    do {
      const envelope = await this.fetchOwnerPage({ ...query, page, size: MAX_PAGE_SIZE });
      owners.push(...envelope.content);
      totalPages = envelope.totalPages;
      page++;
    } while (page < totalPages && page < MAX_PAGES_TO_WALK);
    return owners;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  /** The grid renders "Last, First" — it sorts by last name, so that is what the eye reads first. */
  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .filter(owner => `${owner.lastName ?? ''}${owner.firstName ?? ''}`.trim().length > 0)
      .map(owner => `${owner.lastName}, ${owner.firstName}`);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Name cells read "Last, First", so the last name is everything before the comma. */
  static extractLastName(fullName: string): string {
    const comma = fullName.indexOf(',');
    return comma < 0 ? fullName.trim() : fullName.substring(0, comma).trim();
  }

  static choosePrefixFrom(owners: OwnerDto[]): string {
    for (const owner of owners) {
      if (owner.lastName && owner.lastName.trim()) {
        const lastName = owner.lastName.trim();
        return lastName.substring(0, Math.min(2, lastName.length));
      }
    }
    throw new Error('No owners available to derive search prefix');
  }
}
