import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of add-visit.spec.ts, as plain functions: named for what the
// reader of a scenario wants to see, not for the widget being clicked. The
// selectors live here so the spec never mentions one.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface OwnerWithPet {
  ownerId: number;
  petId: number;
}

export async function anOwnerWithAtLeastOnePetExists(): Promise<OwnerWithPet> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const ownerWithPet = owners.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
  if (!ownerWithPet) {
    throw new Error('No owner with a pet found in the system; cannot run add-visit scenario');
  }
  return {ownerId: ownerWithPet.id, petId: ownerWithPet.pets[0].id};
}

export async function openOwnerDetailPage(page: Page, ownerId: number): Promise<void> {
  await page.goto(`/owners/${ownerId}`);
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

export async function clickAddVisitForFirstPet(page: Page, buttonLabel: string): Promise<void> {
  await page.locator('app-pet-list').first().locator(`button:has-text("${buttonLabel}")`).click();
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

/** Returns the generated description, so the caller can later assert on that exact row. */
export async function fillVisitDateAndUniqueDescription(page: Page, date: string): Promise<string> {
  const description = `Annual check-up ${Date.now()}`;
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill(description);
  return description;
}

/**
 * Picks the first real vet in the dropdown and returns its displayed name.
 * "First real" is expressed as "the first option that carries a vet id", not as
 * index 1 — the placeholder's position is an incidental fact about the template,
 * and anchoring on it turns a reordered option into a baffling failure here.
 */
export async function selectFirstVetInVisitForm(page: Page): Promise<string> {
  const vetSelect = page.locator('select#vetId');
  const firstVet = vetSelect.locator('option:not([value$="null"]):not([value=""])').first();
  const vetName = (await firstVet.textContent() || '').trim();
  await vetSelect.selectOption({label: vetName});
  return vetName;
}

export async function submitVisitForm(page: Page): Promise<void> {
  await page.locator('button[type="submit"]:has-text("Add Visit")').click();
}

export async function expectBackOnOwnerDetailPage(page: Page, ownerId: number): Promise<void> {
  await page.waitForURL(new RegExp(`/owners/${ownerId}$`), {timeout: 10_000});
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

export async function expectPetVisitListContains(page: Page, date: string, description: string): Promise<void> {
  await expect(visitRow(page, date, description)).toBeVisible({timeout: 10_000});
}

export async function expectPetVisitListShowsVet(
  page: Page, date: string, description: string, vetName: string): Promise<void> {
  await expect(visitRow(page, date, description)).toContainText(vetName, {timeout: 10_000});
}

function visitRow(page: Page, date: string, description: string) {
  const petBlock = page.locator('app-pet-list').first();
  return petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: description});
}
