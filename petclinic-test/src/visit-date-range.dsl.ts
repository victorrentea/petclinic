import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of visit-date-range.spec.ts (GitHub issue #40), as plain functions —
// same shape as add-visit.dsl.ts: named for what the reader of a scenario wants to see,
// with every selector kept out of the spec.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';

export interface PetUnderTest {
  ownerId: number;
  petId: number;
  petName: string;
  /** yyyy-MM-dd; the floor of the allowed visit-date range. */
  birthDate: string;
}

export const ABSURD_PAST_DATE = '0009-07-20';   // the issue's own repro value

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Comfortably past the one-year ceiling, whatever today is. */
export const TOO_FAR_FUTURE_DATE = isoDaysFromToday(2 * 365);
/** Comfortably inside the window: after any sample pet's birth, well under a year ahead. */
export const VALID_DATE = isoDaysFromToday(30);

export async function aPetWithAKnownBirthDateExists(): Promise<PetUnderTest> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const owner = owners.find((o: any) => (o.pets || []).some((p: any) => p.birthDate));
  if (!owner) {
    throw new Error('No owner with a pet that has a birth date; cannot check the visit-date range');
  }
  const pet = owner.pets.find((p: any) => p.birthDate);
  return {ownerId: owner.id, petId: pet.id, petName: pet.name, birthDate: pet.birthDate};
}

export async function openNewVisitForm(page: Page, petId: number): Promise<void> {
  await page.goto(`/pets/${petId}/visits/add`);
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

/**
 * A Material datepicker only surfaces its validation once the control has been touched and
 * left, so the blur is part of "entering a date" — without it the form stays pristine and
 * every help-block is hidden no matter what was typed.
 */
export async function enterVisitDate(page: Page, date: string): Promise<void> {
  const input = page.locator('input[name="date"]');
  await input.fill(date);
  await input.blur();
}

export async function enterDescription(page: Page, description: string): Promise<void> {
  await page.locator('input#description').fill(description);
}

export async function expectVisitDateRejected(page: Page, expectedMessage: RegExp): Promise<void> {
  const dateField = page.locator('div.form-group:has(input[name="date"])');
  await expect(dateField.locator('span.help-block').filter({hasText: expectedMessage}))
      .toBeVisible({timeout: 5_000});
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
}

export async function expectVisitDateAccepted(page: Page): Promise<void> {
  const dateField = page.locator('div.form-group:has(input[name="date"])');
  await expect(dateField.locator('span.help-block')).toHaveCount(0);
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
}

export interface ApiAttempt {
  status: number;
  /** Set when the API accepted the visit, so the test can delete what it created. */
  createdId?: number;
}

export async function postVisitToApi(petId: number, date: string, description: string): Promise<ApiAttempt> {
  const response = await axios.post(`${API_BASE}/visits`, {petId, date, description},
      {timeout: 10_000, validateStatus: () => true});
  const location = response.headers.location as string | undefined;
  const createdId = location ? Number(location.split('/').pop()) : undefined;
  return {status: response.status, createdId};
}

export async function anExistingVisitOf(petId: number): Promise<{id: number; description: string}> {
  const {data: visits} = await axios.get(`${API_BASE}/visits`, {timeout: 10_000});
  const visit = visits.find((v: any) => v.petId === petId);
  if (!visit) {
    throw new Error(`Pet ${petId} has no visit to edit; cannot check the range on the update path`);
  }
  return {id: visit.id, description: visit.description};
}

/** Sends the edit the UI sends, with only the date swapped, so a 200 would be a real regression. */
export async function putVisitDateToApi(visitId: number, date: string, description: string): Promise<number> {
  const response = await axios.put(`${API_BASE}/visits/${visitId}`, {date, description},
      {timeout: 10_000, validateStatus: () => true});
  return response.status;
}

export async function deleteVisit(visitId: number): Promise<void> {
  await axios.delete(`${API_BASE}/visits/${visitId}`, {timeout: 10_000, validateStatus: () => true});
}
