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

// Walks the pages: the pet-less owners other runs leave behind ("Ada Acceptance…") sort first by name.
export async function an_owner_with_at_least_one_pet_exists(): Promise<OwnerWithPet> {
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${API_BASE}/owners?size=100&page=${page}`, {timeout: 10_000});
    const ownerWithPet = data.content.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
    if (ownerWithPet) {
      return {ownerId: ownerWithPet.id, petId: ownerWithPet.pets[0].id};
    }
    if (page + 1 >= data.totalPages) {
      throw new Error('No owner with a pet found in the system; cannot run add-visit scenario');
    }
  }
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

export async function submit_visit_form(page: Page): Promise<void> {
  await page.locator('button[type="submit"]:has-text("Add Visit")').click();
}

export async function expect_back_on_owner_detail_page(page: Page, ownerId: number): Promise<void> {
  await page.waitForURL(new RegExp(`/owners/${ownerId}$`), {timeout: 10_000});
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

export async function expect_pet_visit_list_contains(page: Page, date: string, description: string): Promise<void> {
  const petBlock = page.locator('app-pet-list').first();
  const row = petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: description});
  await expect(row).toBeVisible({timeout: 10_000});
}
