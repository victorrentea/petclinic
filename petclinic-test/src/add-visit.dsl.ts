import {expect, Page} from '@playwright/test';
import {anOwnerWhosePetsMatch} from './support/api-client';

// The sentences of add-visit.spec.ts, as plain functions: named for what the
// reader of a scenario wants to see, not for the widget being clicked. The
// selectors live here so the spec never mentions one.

export interface OwnerWithPet {
  ownerId: number;
  petId: number;
}

export async function anOwnerWithAtLeastOnePetExists(): Promise<OwnerWithPet> {
  const {owner, pet} = await anOwnerWhosePetsMatch(() => true);
  return {ownerId: owner.id, petId: pet.id};
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

export async function submitVisitForm(page: Page): Promise<void> {
  await page.locator('button[type="submit"]:has-text("Add Visit")').click();
}

export async function expectBackOnOwnerDetailPage(page: Page, ownerId: number): Promise<void> {
  await page.waitForURL(new RegExp(`/owners/${ownerId}$`), {timeout: 10_000});
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

export async function expectPetVisitListContains(page: Page, date: string, description: string): Promise<void> {
  const petBlock = page.locator('app-pet-list').first();
  const row = petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: description});
  await expect(row).toBeVisible({timeout: 10_000});
}
