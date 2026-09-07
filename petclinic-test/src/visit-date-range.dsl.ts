import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of visit-date-range.spec.ts. Same shape as add-visit.dsl.ts:
// selectors live here so the scenario reads as prose.
//
// Nothing here submits the form, and the only POST it fires is one the API is
// expected to reject — so this spec never adds a row, which visits.spec.ts
// (comparing the whole visit list) depends on.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface PetUnderTest {
  ownerId: number;
  petId: number;
  birthDate: string;
}

export async function a_pet_with_a_known_birth_date_exists(): Promise<PetUnderTest> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  for (const owner of owners) {
    const pet = (owner.pets || []).find((p: any) => p.birthDate);
    if (pet) {
      return {ownerId: owner.id, petId: pet.id, birthDate: pet.birthDate};
    }
  }
  throw new Error('No pet with a birth date found; cannot run visit-date-range scenario');
}

export async function open_add_visit_form(page: Page, petId: number): Promise<void> {
  await page.goto(`/pets/${petId}/visits/add`);
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

export async function fill_visit_date_and_description(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input[name="date"]').blur();
  await page.locator('input#description').fill('Date range check');
  await page.locator('input#description').blur();
}

export async function expect_visit_is_rejected(page: Page): Promise<void> {
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
}

export async function expect_visit_is_accepted(page: Page): Promise<void> {
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
}

export async function expect_out_of_range_message_is_shown(page: Page): Promise<void> {
  await expect(page.locator('.help-block', {hasText: /between the pet's birth date and one year from now/i}))
    .toBeVisible({timeout: 10_000});
}

/** Posts straight to the API, bypassing the form, so the backend is held to the same rule. */
export async function api_rejects_visit_on(petId: number, date: string): Promise<void> {
  const response = await axios.post(`${API_BASE}/visits`,
    {petId, date, description: 'Date range check'},
    {timeout: 10_000, validateStatus: () => true});
  expect(response.status, `POST /visits with date ${date} should be rejected`).toBe(400);
}

export async function api_accepts_visit_on(petId: number, date: string): Promise<void> {
  const response = await axios.post(`${API_BASE}/visits`,
    {petId, date, description: 'Date range check'},
    {timeout: 10_000, validateStatus: () => true});
  expect(response.status, `POST /visits with date ${date} should be accepted`).toBe(201);
  await deleteVisitAt(response.headers.location);
}

/** The one row this spec creates is removed again, so the shared visit list is left as found. */
async function deleteVisitAt(location: string | undefined): Promise<void> {
  if (!location) {
    throw new Error('POST /visits returned 201 without a Location header; cannot clean up');
  }
  const id = location.substring(location.lastIndexOf('/') + 1);
  await axios.delete(`${API_BASE}/visits/${id}`, {timeout: 10_000});
}

export function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayBefore(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
