import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of book-slot.spec.ts. Same shape as add-visit.dsl.ts: named for what the
// reader of the scenario wants to see, with every selector kept out of the spec.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface BookableDay {
  ownerId: number;
  vetName: string;
  date: string;
}

/** The first vet-and-weekday inside the generated horizon that still has a free slot. */
export async function aVetWithAFreeSlotExists(): Promise<BookableDay> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const ownerWithPet = owners.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
  if (!ownerWithPet) {
    throw new Error('No owner with a pet found in the system; cannot run the slot-booking scenario');
  }
  const {data: vets} = await axios.get(`${API_BASE}/vets`, {timeout: 10_000});
  for (const vet of vets) {
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const date = isoDateIn(dayOffset);
      const {data: slots} = await axios.get(`${API_BASE}/vets/${vet.id}/slots`, {
        params: {date},
        timeout: 10_000,
      });
      if (slots.length > 0) {
        return {ownerId: ownerWithPet.id, vetName: `${vet.firstName} ${vet.lastName}`, date};
      }
    }
  }
  throw new Error('No vet has a free slot in the next 14 days; has SlotGenerator run?');
}

export async function openOwnerDetailPage(page: Page, ownerId: number): Promise<void> {
  await page.goto(`/owners/${ownerId}`);
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

export async function clickAddVisitForFirstPet(page: Page): Promise<void> {
  await page.locator('app-pet-list').first().locator('button:has-text("Add Visit")').click();
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

export async function chooseVetAndDate(page: Page, vetName: string, date: string): Promise<void> {
  await page.locator('select#vetId').selectOption({label: vetName});
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input[name="date"]').blur();
}

/** Returns the label of the slot taken, so the caller can assert on that exact time. */
export async function bookTheFirstFreeSlot(page: Page): Promise<string> {
  const firstSlot = page.locator('#slot-picker button.slot-button').first();
  await expect(firstSlot).toBeVisible({timeout: 10_000});
  const label = (await firstSlot.textContent())!.trim();
  await firstSlot.click();
  await expect(firstSlot).toHaveClass(/btn-primary/);
  return label;
}

export async function describeTheVisit(page: Page): Promise<string> {
  const description = `Slot booking ${Date.now()}`;
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

export async function expectVisitsPageShowsVetAndTime(
  page: Page, description: string, vetName: string, slotLabel: string): Promise<void> {
  await page.goto('/visits');
  const row = page.locator('#visitsTable tbody tr').filter({hasText: description});
  await expect(row).toBeVisible({timeout: 10_000});
  await expect(row.locator('.visit-vet')).toHaveText(vetName);
  await expect(row.locator('.visit-time')).toHaveText(slotLabel.split('–')[0]);
}

export async function expectTheSlotIsGoneFromThePicker(page: Page, ownerId: number,
                                                       vetName: string, date: string,
                                                       slotLabel: string): Promise<void> {
  await openOwnerDetailPage(page, ownerId);
  await clickAddVisitForFirstPet(page);
  await chooseVetAndDate(page, vetName, date);
  await expect(page.locator('#slot-picker button.slot-button', {hasText: slotLabel})).toHaveCount(0);
}

function isoDateIn(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
