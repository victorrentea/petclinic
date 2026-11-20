import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {OwnerPage} from './pages/OwnerPage';
import {VisitForm} from './pages/VisitForm';
import {VisitsPage} from './pages/VisitsPage';

// The sentences of add-visit.spec.ts and of visit-vet.feature's glue, as plain functions:
// named for what the reader of a scenario wants to see. Each one is a line or two over the
// page objects in pages/, which are the only place a selector is written.

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

/**
 * The vet field is there, and before anyone touches it it already says nobody: the form
 * asks who will attend without forcing an answer. `No vet` is the label `visit-vet.pipe.ts`
 * (NO_VET) gives the empty choice, so the booking form and the visit lists use one word.
 */
export async function expect_visit_form_offers_nobody_yet(page: Page): Promise<void> {
  await expect(new VisitForm(page).chosenVet).toHaveText(NO_VET);
}

/** Picks the first real vet the form offers and returns the name it showed. */
export async function select_first_vet_in_visit_form(page: Page): Promise<string> {
  return new VisitForm(page).chooseFirstVet();
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

/** The owner's page names the vet on the visit's row — or says `No vet`, never a blank. */
export async function expect_pet_visit_list_shows_vet(
  page: Page, date: string, description: string, vet: string): Promise<void> {
  await expect(new OwnerPage(page).pet(0).vetOfVisit(date, description)).toHaveText(vet, {timeout: 10_000});
}

export async function open_all_visits_screen(page: Page): Promise<void> {
  await new VisitsPage(page).open();
}

/** The all-visits screen names the same vet on the same visit (found by its unique description). */
export async function expect_all_visits_screen_shows_vet(
  page: Page, description: string, vet: string): Promise<void> {
  await expect(new VisitsPage(page).vetOfVisit(description)).toHaveText(vet, {timeout: 10_000});
}
