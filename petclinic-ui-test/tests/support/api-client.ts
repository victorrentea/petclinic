import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

// List read-model row returned inside the Page envelope by GET /api/owners.
export interface OwnerListRow {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  petNames: string[];
}

// Spring-style page envelope returned by GET /api/owners.
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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

// Query params for a single owners page fetch. Only set what a test cares about;
// the server applies its own defaults (page 0, size 10, sort name,asc) otherwise.
export interface OwnersPageQuery {
  lastName?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  // Fetch one owners page so specs can compute the expected order/counts the
  // same way the screen does — straight from the server.
  async fetchOwnersPage(query: OwnersPageQuery = {}): Promise<Page<OwnerListRow>> {
    const response = await this.client.get<Page<OwnerListRow>>('/owners', { params: query });
    return response.data;
  }

  async fetchOwners(): Promise<OwnerListRow[]> {
    const firstPage = await this.fetchOwnersPage({ page: 0, size: 100 });
    if (firstPage.totalPages <= 1) {
      return firstPage.content;
    }
    const all: OwnerListRow[] = [...firstPage.content];
    for (let pageIndex = 1; pageIndex < firstPage.totalPages; pageIndex++) {
      const next = await this.fetchOwnersPage({ page: pageIndex, size: 100 });
      all.push(...next.content);
    }
    return all;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerListRow[]> {
    const firstPage = await this.fetchOwnersPage({ lastName: prefix, page: 0, size: 100 });
    if (firstPage.totalPages <= 1) {
      return firstPage.content;
    }
    const all: OwnerListRow[] = [...firstPage.content];
    for (let pageIndex = 1; pageIndex < firstPage.totalPages; pageIndex++) {
      const next = await this.fetchOwnersPage({ lastName: prefix, page: pageIndex, size: 100 });
      all.push(...next.content);
    }
    return all;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  static getFullNames(owners: OwnerListRow[]): string[] {
    return ApiClient.rowFullNames(owners);
  }

  // The visible name-cell text the screen renders, in the same row order as the
  // API page. Trims so it matches DOM textContent comparisons exactly.
  static rowFullNames(rows: OwnerListRow[]): string[] {
    return rows.map(row => `${row.firstName} ${row.lastName}`.trim()).filter(name => name.length > 0);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  static extractLastName(fullName: string): string {
    const firstSpace = fullName.indexOf(' ');
    if (firstSpace < 0 || firstSpace === fullName.length - 1) {
      return fullName;
    }
    return fullName.substring(firstSpace + 1);
  }

  static choosePrefixFrom(owners: OwnerListRow[]): string {
    for (const owner of owners) {
      if (owner.lastName && owner.lastName.trim()) {
        const lastName = owner.lastName.trim();
        return lastName.substring(0, Math.min(2, lastName.length));
      }
    }
    throw new Error('No owners available to derive search prefix');
  }

  // Find a last-name prefix that narrows the supplied rows to `max` or fewer
  // owners (used to exercise the paginator-hide threshold). Returns null when
  // no prefix is narrow enough, so the spec can skip rather than fail.
  static narrowPrefix(rows: OwnerListRow[], max: number): string | null {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const lastName = (row.lastName || '').trim();
      if (lastName.length === 0) {
        continue;
      }
      const prefix = lastName.substring(0, Math.min(2, lastName.length)).toLowerCase();
      counts.set(prefix, (counts.get(prefix) || 0) + 1);
    }
    for (const [prefix, count] of counts) {
      if (count >= 1 && count <= max) {
        return prefix;
      }
    }
    return null;
  }
}
