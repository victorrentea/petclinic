import axios from 'axios';

// GET /api/owners now returns a page envelope (see openapi.yaml), capped at size=20.
// This walks every page so callers that need the *whole* owner list (the search
// background, add-visit's "find any owner with a pet", the visit-date-range bug-40
// lookup) keep working without each of them reimplementing the paging loop.

export interface PetDto {
  id: number;
  name: string;
  birthDate?: string;
}

export interface OwnerDto {
  id: number;
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  telephone?: string;
  pets?: PetDto[];
}

interface OwnerPageDto {
  content: OwnerDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const MAX_PAGE_SIZE = 20;

export async function fetchAllOwners(apiBase: string): Promise<OwnerDto[]> {
  const all: OwnerDto[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const {data} = await axios.get<OwnerPageDto>(`${apiBase}/owners`, {
      params: {page, size: MAX_PAGE_SIZE},
      timeout: 10_000,
    });
    all.push(...data.content);
    totalPages = data.totalPages;
    page += 1;
  } while (page < totalPages);
  return all;
}
