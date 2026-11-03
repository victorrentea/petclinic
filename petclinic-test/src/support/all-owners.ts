import axios from 'axios';

/** Every owner, read page by page: `GET /api/owners` never returns more than one page. */
export async function allOwners<T = any>(apiBase: string): Promise<T[]> {
  const owners: T[] = [];
  for (let page = 0, totalPages = 1; page < totalPages; page++) {
    const {data} = await axios.get(`${apiBase}/owners`, {params: {page, size: 20}, timeout: 10_000});
    owners.push(...data.content);
    totalPages = data.totalPages;
  }
  return owners;
}
