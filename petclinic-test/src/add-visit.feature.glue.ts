import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {
  an_owner_with_at_least_one_pet_exists,
  click_add_visit_for_first_pet,
  expect_back_on_owner_detail_page,
  expect_pet_visit_list_shows_no_vet,
  expect_pet_visit_list_shows_vet,
  fill_visit_date_and_unique_description,
  open_owner_detail_page,
  select_attending_vet,
  submit_visit_form,
} from './add-visit.dsl';

// Gherkin over the DSL, and on purpose — the opposite choice from owner-search.feature.glue.ts,
// for the opposite reason. There, the steps do the work themselves because no DSL existed and
// naming the same sentences twice would only add indirection. Here the sentences already exist,
// written for add-visit.spec.ts, and the point of this file is to put a second front end on
// them: same clicks, same selectors, same waits, one scenario read as Gherkin and one as
// TypeScript. Copying the locators into this file instead would give the reader a difference
// that is not about reading, and give the next UI change two places to break.
//
// So nothing below decides anything either. Every step is a sentence and an argument.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// A date of its own, so a diagram or a screenshot from this run is telling about this run.
// Uniqueness is not what it is for — the description carries that, per the DSL.
const VISIT_DATE = '2026-06-18';

const fullName = (v: {firstName: string; lastName: string}) => `${v.firstName} ${v.lastName}`;

function bookedVisit(world: PlaywrightWorld): {ownerId: number; description: string} {
  if (world.ownerId === undefined || world.visitDescription === undefined) {
    throw new Error('Expected a visit to have been booked earlier in the scenario');
  }
  return {ownerId: world.ownerId, description: world.visitDescription};
}

async function bookVisit(world: PlaywrightWorld, attendingVet?: string): Promise<void> {
  if (world.ownerId === undefined) {
    throw new Error('Expected the pet to have been found earlier in the scenario');
  }
  await open_owner_detail_page(world.page, world.ownerId);
  await click_add_visit_for_first_pet(world.page, 'Add Visit');
  world.visitDescription = await fill_visit_date_and_unique_description(world.page, VISIT_DATE);
  if (attendingVet !== undefined) {
    await select_attending_vet(world.page, attendingVet);
    world.vetName = attendingVet;
  }
  await submit_visit_form(world.page);
  await expect_back_on_owner_detail_page(world.page, world.ownerId);
}

Given('a pet registered with the clinic', async function (this: PlaywrightWorld) {
  const {ownerId, petId} = await an_owner_with_at_least_one_pet_exists();
  this.ownerId = ownerId;
  this.petId = petId;
});

/**
 * Named in the Background rather than picked at random, because the Then names her too.
 * Checking her here means a changed seed (Flyway's V3__sample_data.sql) fails on the Given
 * instead of looking like a booking that lost its vet.
 */
Given("{string} is one of the clinic's vets", async function (this: PlaywrightWorld, vetName: string) {
  const {data} = await axios.get(`${API_BASE}/vets`, {timeout: 10_000});
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('The API returned no vets — is the backend up and the DB seeded by Flyway?');
  }
  expect(data.map(fullName)).toContain(vetName);
});

When('I book a visit for that pet with {string} attending',
  async function (this: PlaywrightWorld, vetName: string) {
    await bookVisit(this, vetName);
  });

When('I book a visit for that pet with nobody attending', async function (this: PlaywrightWorld) {
  await bookVisit(this);
});

Then('that pet\'s history shows the visit was attended by {string}',
  async function (this: PlaywrightWorld, vetName: string) {
    const {description} = bookedVisit(this);
    await expect_pet_visit_list_shows_vet(this.page, VISIT_DATE, description, vetName);
  });

/**
 * "Attended by nobody" is a statement the history makes out loud — an em dash in the vet
 * column, per VetNamePipe.NOT_ATTENDED — not the absence of one. Booking without a vet is a
 * supported path: the vet is optional, and legacy and MCP-booked visits have none.
 */
Then('that pet\'s history shows the visit was attended by nobody', async function (this: PlaywrightWorld) {
  const {description} = bookedVisit(this);
  await expect_pet_visit_list_shows_no_vet(this.page, VISIT_DATE, description);
});
