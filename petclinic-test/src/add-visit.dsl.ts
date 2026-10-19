import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of add-visit.spec.ts, as plain functions: named for what the
// reader of a scenario wants to see, not for the widget being clicked. The
// selectors live here so the spec never mentions one.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

/** What a visit nobody attended reads as — `NO_VET` in petclinic-frontend's visit-vet.pipe.ts. */
export const NO_VET = 'No vet';

export interface OwnerWithPet {
  ownerId: number;
  petId: number;
}

export async function an_owner_with_at_least_one_pet_exists(): Promise<OwnerWithPet> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const ownerWithPet = owners.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
  if (!ownerWithPet) {
    throw new Error('No owner with a pet found in the system; cannot run add-visit scenario');
  }
  return {ownerId: ownerWithPet.id, petId: ownerWithPet.pets[0].id};
}

export async function open_owner_detail_page(page: Page, ownerId: number): Promise<void> {
  await page.goto(`/owners/${ownerId}`);
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

export async function click_add_visit_for_first_pet(page: Page, buttonLabel: string): Promise<void> {
  await page.locator('app-pet-list').first().locator(`button:has-text("${buttonLabel}")`).click();
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

/** Returns the generated description, so the caller can later assert on that exact row. */
export async function fill_visit_date_and_unique_description(page: Page, date: string): Promise<string> {
  const description = `Annual check-up ${Date.now()}`;
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill(description);
  return description;
}

/**
 * The vet field is there, and before anyone touches it it already says nobody: the form
 * asks who will attend without forcing an answer. `No vet` is the label `visit-vet.pipe.ts`
 * (NO_VET) gives the empty choice, so the booking form and the visit lists use one word.
 */
export async function expect_visit_form_offers_nobody_yet(page: Page): Promise<void> {
  await expect(vetField(page).locator('option:checked')).toHaveText(NO_VET);
}

/**
 * Picks the first real vet the form offers and returns the name it showed. "Real" is the
 * first option after the empty one: `<app-combo>` binds its options by *index*, so the
 * option values say nothing about which vet is which — the label is the only handle.
 */
export async function select_first_vet_in_visit_form(page: Page): Promise<string> {
  const firstVet = vetField(page).locator('option:not([value=""])').first();
  const vetName = ((await firstVet.textContent()) || '').trim();
  expect(vetName, 'the booking form offers no vet to choose').not.toEqual('');
  await vetField(page).selectOption({label: vetName});
  return vetName;
}

export async function submit_visit_form(page: Page): Promise<void> {
  await page.locator('button[type="submit"]:has-text("Add Visit")').click();
}

export async function expect_back_on_owner_detail_page(page: Page, ownerId: number): Promise<void> {
  await page.waitForURL(new RegExp(`/owners/${ownerId}$`), {timeout: 10_000});
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

export async function expect_pet_visit_list_contains(page: Page, date: string, description: string): Promise<void> {
  await expect(petVisitRow(page, date, description)).toBeVisible({timeout: 10_000});
}

/** The owner's page names the vet on the visit's row — or says `No vet`, never a blank. */
export async function expect_pet_visit_list_shows_vet(
  page: Page, date: string, description: string, vet: string): Promise<void> {
  await expect(petVisitRow(page, date, description).locator('td.visit-vet')).toHaveText(vet, {timeout: 10_000});
}

export async function open_all_visits_screen(page: Page): Promise<void> {
  await page.goto('/visits');
  await page.locator('h2:has-text("Visits")').waitFor({state: 'visible', timeout: 10_000});
}

/** The all-visits screen names the same vet on the same visit (found by its unique description). */
export async function expect_all_visits_screen_shows_vet(
  page: Page, description: string, vet: string): Promise<void> {
  const row = page.locator('#visitsTable tbody tr')
    .filter({has: page.locator('td.visit-description', {hasText: description})});
  await expect(row.locator('td.visit-vet')).toHaveText(vet, {timeout: 10_000});
}

function vetField(page: Page) {
  return page.locator('select#vet');
}

function petVisitRow(page: Page, date: string, description: string) {
  const petBlock = page.locator('app-pet-list').first();
  return petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: description});
}
