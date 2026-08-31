import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {findOwner, petsOf} from './support/owners-api';

// The sentences of visit-date-validation.spec.ts (issue #40): a visit may not be dated
// before the pet was born, nor more than a year ahead. Selectors live here, never in the spec.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface PetWithBirthDate {
  ownerId: number;
  petId: number;
  petName: string;
  birthDate: string;
}

export async function aPetWithAKnownBirthDateExists(): Promise<PetWithBirthDate> {
  const owner = await findOwner((o) => petsOf(o).some((pet) => !!pet.birthDate));
  if (!owner) {
    throw new Error('No pet with a birth date found; cannot run the visit-date-range scenario');
  }
  const pet = petsOf(owner).find((p) => p.birthDate)!;
  return {ownerId: owner.id, petId: pet.id, petName: pet.name, birthDate: pet.birthDate!};
}

export function daysBefore(date: string, days: number): string {
  return shift(date, -days);
}

export function daysAfter(date: string, days: number): string {
  return shift(date, days);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function shift(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export async function openAddVisitFormForFirstPet(page: Page, ownerId: number): Promise<void> {
  await page.goto(`/owners/${ownerId}`);
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await page.locator('app-pet-list').first().locator('button:has-text("Add Visit")').click();
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

export async function fillVisitForm(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill('date range check');
}

export async function expectDateRejectedAsTooEarly(page: Page): Promise<void> {
  await expect(page.locator('#date-min-error')).toBeVisible({timeout: 5_000});
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
}

export async function expectDateRejectedAsTooFarAhead(page: Page): Promise<void> {
  await expect(page.locator('#date-max-error')).toBeVisible({timeout: 5_000});
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
}

export async function expectDateAccepted(page: Page): Promise<void> {
  await expect(page.locator('#date-min-error')).toHaveCount(0);
  await expect(page.locator('#date-max-error')).toHaveCount(0);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
}

/** Posts straight at the API, bypassing the form — the backend must refuse on its own. */
export async function postVisitDirectly(petId: number, date: string): Promise<number> {
  try {
    const {status} = await axios.post(`${API_BASE}/visits`,
        {petId, date, description: 'date range check'}, {timeout: 10_000});
    return status;
  } catch (error: any) {
    if (error.response) {
      return error.response.status;
    }
    throw error;
  }
}
