import {randomUUID} from 'crypto';
import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of add-visit.spec.ts, as plain functions: named for what the
// reader of a scenario wants to see, not for the widget being clicked. The
// selectors live here so the spec never mentions one.
//
// add-visit.feature tells the same story in Gherkin and its glue binds the steps to
// these very same functions. That is deliberate: with identical mechanics underneath,
// the only thing left to compare between the two scenarios is how each one reads —
// which is the whole point of keeping both. It also means one selector change here
// fixes both, instead of a second copy of these locators rotting in the glue.
//
// Named in snake_case, so a scenario body reads as a sentence rather than as calls.

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
/**
 * The description is what a later assertion finds the row by, so it has to be unique
 * across the whole suite — not merely across one file.
 *
 * `Date.now()` alone is not: the specs run in parallel workers against one shared
 * database, and two of them filling the form in the same millisecond produced the same
 * "unique" description. The assertions then matched both rows and failed on strict mode,
 * blaming whichever test came second. A random suffix is what actually makes it unique.
 */
export async function fill_visit_date_and_unique_description(page: Page, date: string): Promise<string> {
  const description = `Annual check-up ${Date.now()}-${randomUUID().slice(0, 8)}`;
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
export async function select_first_vet_in_visit_form(page: Page): Promise<string> {
  const vetSelect = page.locator('select#vetId');
  const firstVet = vetSelect.locator('option:not([value$="null"]):not([value=""])').first();
  const vetName = (await firstVet.textContent() || '').trim();
  await vetSelect.selectOption({label: vetName});
  return vetName;
}

/**
 * Picks the vet the scenario named, rather than whichever one comes first.
 *
 * Both sentences earn their place: the Playwright scenario does not care who attended, so
 * it says "the first vet"; a Gherkin scenario that says "with Helen Leary attending" has to
 * mean Helen Leary, or the Then below is asserting whatever the When happened to pick.
 */
export async function select_attending_vet(page: Page, vetName: string): Promise<void> {
  await page.locator('select#vetId').selectOption({label: vetName});
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
 * The vet column reads "not attended" — an em dash, per VetNamePipe.NOT_ATTENDED.
 *
 * Booking without choosing a vet is a supported path, not an oversight: the vet is
 * optional, and legacy and MCP-booked visits have none. Asserting the dash is what makes
 * the no-vet case a statement rather than the absence of one.
 */
export async function expect_pet_visit_list_shows_no_vet(
  page: Page, date: string, description: string): Promise<void> {
  await expect(visitRow(page, date, description).locator('.visit-vet'))
    .toHaveText('—', {timeout: 10_000});
}

export async function expect_pet_visit_list_shows_vet(
  page: Page, date: string, description: string, vetName: string): Promise<void> {
  await expect(visitRow(page, date, description)).toContainText(vetName, {timeout: 10_000});
}

function visitRow(page: Page, date: string, description: string) {
  const petBlock = page.locator('app-pet-list').first();
  return petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: description});
}
