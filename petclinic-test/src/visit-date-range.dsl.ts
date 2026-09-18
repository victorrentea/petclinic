import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of visit-date-range.spec.ts. Selectors live here so the spec never
// mentions one — same split as add-visit.dsl.ts.
//
// Dates are computed from the real clock rather than written down, because the rule
// under test ("no more than a year ahead") is itself relative to today: a literal
// would start passing for the wrong reason on some future afternoon.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface FixturePet {
  ownerId: number;
  petId: number;
  birthDate: string;
}

export const iso = (d: Date): string => d.toISOString().slice(0, 10);

export const today = (): Date => new Date(`${iso(new Date())}T00:00:00Z`);

export function daysFromToday(days: number): string {
  return iso(new Date(today().getTime() + days * MS_PER_DAY));
}

export function yearsFromToday(years: number, plusDays = 0): string {
  const d = today();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return iso(new Date(d.getTime() + plusDays * MS_PER_DAY));
}

/**
 * Never owner 1: add-visit.spec.ts reaches for the first owner that has a pet and clicks
 * "Add Visit" on its first one, and the suite is fullyParallel against one shared database.
 * A fixture pet landing in that list is a race nobody would enjoy debugging.
 */
async function anOwnerWithoutPets(): Promise<number> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const free = owners.filter((o: {pets?: unknown[]}) => !o.pets || o.pets.length === 0);
  const pick = (free.length ? free : owners).at(-1);
  expect(pick, 'The clinic has no owners at all — is the DB seeded?').toBeTruthy();
  return pick.id;
}

export async function a_pet_born(birthDate: string, ownerId?: number): Promise<FixturePet> {
  const owner = ownerId ?? await anOwnerWithoutPets();
  const {data: types} = await axios.get(`${API_BASE}/pettypes`, {timeout: 10_000});
  const created = await axios.post(`${API_BASE}/owners/${owner}/pets`,
    {name: `DateRangeFixture ${Date.now()}`, birthDate, type: types[0]}, {timeout: 10_000});
  const petId = Number(String(created.headers.location ?? '').split('/').pop());
  expect(petId, 'Expected the new pet id in the Location header').toBeGreaterThan(0);
  return {ownerId: owner, petId, birthDate};
}

/**
 * Visits first: the pet row is referenced by them, and a DELETE that fails on the
 * constraint leaves the fixture behind for every later run to trip over.
 * The route is /api/pets/{id} — there is no delete under /api/owners/{id}/pets.
 */
export async function forget_pet(pet: FixturePet): Promise<void> {
  const {data} = await axios.get(`${API_BASE}/pets/${pet.petId}`,
    {timeout: 10_000, validateStatus: () => true});
  for (const visit of data?.visits ?? []) {
    await axios.delete(`${API_BASE}/visits/${visit.id}`, {timeout: 10_000, validateStatus: () => true});
  }
  await axios.delete(`${API_BASE}/pets/${pet.petId}`, {timeout: 10_000, validateStatus: () => true});
}

export async function open_new_visit_form(page: Page, pet: FixturePet): Promise<void> {
  await page.goto(`/pets/${pet.petId}/visits/add`);
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

export async function fill_visit(page: Page, date: string, description = 'Date range check'): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill(description);
}

export async function expect_booking_offered(page: Page): Promise<void> {
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
}

export async function expect_booking_blocked(page: Page, why: string): Promise<void> {
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")'),
    `"Add Visit" stayed clickable although ${why}`).toBeDisabled();
}

/** The message the form owes the user — a disabled button alone explains nothing. */
export async function expect_date_error_explains_the_range(page: Page): Promise<void> {
  await expect(page.locator('.help-block', {hasText: /date must be/i})).toBeVisible({timeout: 5_000});
}

export async function api_refuses_visit(pet: FixturePet, date: string): Promise<void> {
  const res = await axios.post(`${API_BASE}/visits`,
    {petId: pet.petId, date, description: 'Straight at the API'},
    {timeout: 10_000, validateStatus: () => true});
  expect(res.status,
    `POST /api/visits accepted ${date} for a pet born ${pet.birthDate}; the form is not ` +
    `the only way in, so the API has to refuse it too`).toBe(400);
}
