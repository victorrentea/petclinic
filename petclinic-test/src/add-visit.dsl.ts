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
 * Picks the first real vet the form offers and returns the name it showed.
 *
 * "First real" is expressed as "the first option that carries a value", not as index 1:
 * `<app-combo>` renders the `-- none --` placeholder as the one option bound to the empty
 * string, so that is what identifies it. Anchoring on its position instead would turn a
 * reordered template into a baffling failure here — and the scenario does not care which
 * vet it gets, only that whoever it picked is the one the visit comes back with.
 */
export async function select_first_vet_in_visit_form(page: Page): Promise<string> {
  const vetSelect = page.locator('select#vet');
  const firstVet = vetSelect.locator('option:not([value=""])').first();
  const vetName = (await firstVet.textContent() || '').trim();
  await vetSelect.selectOption(await firstVet.getAttribute('value') || '');
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
  await expect(visitRow(page, date, description)).toBeVisible({timeout: 10_000});
}

/**
 * The vet column reads "none" — the label `vetLabel()` gives a visit nobody attended.
 *
 * Booking without choosing a vet is a supported path, not an oversight: the field is
 * optional, and every visit made before this change has no vet at all. Asserting the word
 * is what makes the no-vet case a statement rather than the absence of one — an empty cell
 * and a cell the page forgot to fill look identical from here.
 */
export async function expect_pet_visit_list_shows_no_vet(
  page: Page, date: string, description: string): Promise<void> {
  await expect(visitRow(page, date, description).locator('.visit-vet'))
    .toHaveText('none', {timeout: 10_000});
}

export async function expect_pet_visit_list_shows_vet(
  page: Page, date: string, description: string, vetName: string): Promise<void> {
  await expect(visitRow(page, date, description).locator('.visit-vet'))
    .toHaveText(vetName, {timeout: 10_000});
}

function visitRow(page: Page, date: string, description: string) {
  const petBlock = page.locator('app-pet-list').first();
  return petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: description});
}
