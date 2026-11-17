import axios from 'axios';

// Creates through the REST API the rows a browser test starts from, so each test owns its data
// instead of leaning on the seed. Every POST answers 201 with only a Location header.
const API = process.env.API_BASE_URL || 'http://localhost:8080/api';

export function uniqueLetters(prefix: string): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += letters[Math.floor(Math.random() * letters.length)];
  return prefix + suffix;
}

async function postForId(path: string, body: object): Promise<number> {
  const {headers} = await axios.post(`${API}${path}`, body, {timeout: 10_000});
  return Number(String(headers.location).split('/').pop());
}

export async function anOwner(): Promise<number> {
  return postForId('/owners', {firstName: 'Ada', lastName: uniqueLetters('Lovelace'),
    address: '110 Analytical Engine Way', city: 'London', telephone: '6085551023'});
}

export async function aDogOf(ownerId: number, name: string): Promise<number> {
  return postForId(`/owners/${ownerId}/pets`, {name, birthDate: '2020-03-15', type: {id: 2, name: 'dog'}});
}

export async function aVisitOf(ownerId: number, petId: number, description: string): Promise<number> {
  return postForId(`/owners/${ownerId}/pets/${petId}/visits`, {date: '2026-05-12', description});
}

export async function getStatus(path: string): Promise<number> {
  const res = await axios.get(`${API}${path}`, {validateStatus: () => true, timeout: 10_000});
  return res.status;
}

export async function getJson<T>(path: string): Promise<T> {
  return (await axios.get(`${API}${path}`, {timeout: 10_000})).data as T;
}
