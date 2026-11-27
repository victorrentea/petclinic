import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {OwnerPage} from './pages/OwnerPage';
import {VisitForm} from './pages/VisitForm';

// The sentences of add-visit.spec.ts, as plain functions: named for what the reader of a
// scenario wants to see. Each one is a line or two over the page objects in pages/, which
// are the only place a selector is written.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface OwnerWithPet {
  ownerId: number;
  petId: number;
}

export async function an_owner_with_at_least_one_pet_exists(): Promise<OwnerWithPet> {
  const {data: {content: owners}} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const ownerWithPet = owners.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
  if (!ownerWithPet) {
    throw new Error('No owner with a pet found in the system; cannot run add-visit scenario');
  }
  return {ownerId: ownerWithPet.id, petId: ownerWithPet.pets[0].id};
}

export async function open_owner_detail_page(page: Page, ownerId: number): Promise<void> {
  await OwnerPage.open(page, ownerId);
}

export async function click_add_visit_for_first_pet(page: Page): Promise<void> {
  await new OwnerPage(page).pet(0).addVisit();
}

/** Returns the generated description, so the caller can later assert on that exact row. */
export async function fill_visit_date_and_unique_description(page: Page, date: string): Promise<string> {
  const description = `Annual check-up ${Date.now()}`;
  await new VisitForm(page).fill(date, description);
  return description;
}

export async function submit_visit_form(page: Page): Promise<void> {
  await new VisitForm(page).submit();
}

export async function expect_back_on_owner_detail_page(page: Page, ownerId: number): Promise<void> {
  await OwnerPage.shown(page, ownerId);
}

export async function expect_pet_visit_list_contains(page: Page, date: string, description: string): Promise<void> {
  await expect(new OwnerPage(page).pet(0).visit(date, description)).toBeVisible({timeout: 10_000});
}
