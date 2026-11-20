import axios from 'axios';

// The owners a scenario states it needs, put there through the REST API.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const MAX_PAGE_SIZE = 20;

export interface OwnerRow {
  name: string;
  city: string;
}

interface OwnerDto {
  firstName: string;
  lastName: string;
  city: string;
}

/**
 * Creates the owner unless one with that full name is already there — on a stack without the
 * reset sidecar the database keeps the previous scenario's owners (and the seed's Potters).
 * A namesake in another city fails here, not later as a wrongly sorted grid.
 */
export async function ensureOwnerExists({name, city}: OwnerRow): Promise<void> {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ');
  const namesake = (await ownersWithLastNameStarting(lastName))
    .find(o => o.firstName === firstName && o.lastName === lastName);
  if (namesake && namesake.city !== city) {
    throw new Error(`${name} already lives in ${namesake.city}, not in ${city}`);
  }
  if (!namesake) {
    await axios.post(`${API_BASE}/owners`,
      {firstName, lastName, city, address: '1 Acceptance Street', telephone: '0123456789'},
      {timeout: 10_000});
  }
}

async function ownersWithLastNameStarting(lastName: string): Promise<OwnerDto[]> {
  const {data} = await axios.get(`${API_BASE}/owners`,
    {params: {lastName, size: MAX_PAGE_SIZE}, timeout: 10_000});
  return data.content;
}

export async function countAllOwners(): Promise<number> {
  const {data} = await axios.get(`${API_BASE}/owners/count`, {timeout: 10_000});
  return Number(data);
}

/** Full names of the first page the API serves with no parameter at all. */
export async function defaultFirstPageNames(): Promise<string[]> {
  const {data} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  return data.content.map((o: OwnerDto) => `${o.firstName} ${o.lastName}`);
}
