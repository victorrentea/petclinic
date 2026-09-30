import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {VisitsPage} from './pages/VisitsPage';
import {
  an_owner_with_at_least_one_pet_exists,
  click_add_visit_for_first_pet,
  expect_back_on_owner_detail_page,
  expect_pet_visit_list_shows_no_vet,
  expect_pet_visit_list_shows_vet,
  fill_visit_date_and_unique_description,
  open_owner_detail_page,
  select_first_vet_in_visit_form,
  submit_visit_form,
} from './add-visit.dsl';

// Gherkin over the DSL, and on purpose — the opposite choice from owner-search.feature.glue.ts,
// for the opposite reason. There the steps do the work themselves, because no DSL exists and a
// second naming of the same sentences would only add indirection. Here the sentences already
// exist, written for add-visit.spec.ts, and the point of this file is to put a second front end
// on them: same clicks, same selectors, same waits, one scenario read as Gherkin and one as
// TypeScript. Copying the locators in would hand the reader a difference that is not about
// reading, and hand the next UI change two places to break.
//
// So nothing below decides anything either: every step is a sentence and an argument.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// A date of its own, so a diagram or a screenshot from this run is telling about this run.
// Uniqueness is not what it is for — the description carries that, per the DSL.
const VISIT_DATE = '2026-06-18';

function bookedVisit(world: PlaywrightWorld): {ownerId: number; description: string} {
  if (world.ownerId === undefined || world.visitDescription === undefined) {
    throw new Error('Expected a visit to have been booked earlier in the scenario');
  }
  return {ownerId: world.ownerId, description: world.visitDescription};
}

async function bookVisit(world: PlaywrightWorld, withAVet: boolean): Promise<void> {
  if (world.ownerId === undefined) {
    throw new Error('Expected the pet to have been found earlier in the scenario');
  }
  await open_owner_detail_page(world.page, world.ownerId);
  await click_add_visit_for_first_pet(world.page, 'Add Visit');
  world.visitDescription = await fill_visit_date_and_unique_description(world.page, VISIT_DATE);
  if (withAVet) {
    world.vetName = await select_first_vet_in_visit_form(world.page);
  }
  await submit_visit_form(world.page);
  await expect_back_on_owner_detail_page(world.page, world.ownerId);
}

function attendingVet(world: PlaywrightWorld): string {
  if (!world.vetName) {
    throw new Error('Expected a vet to have been chosen earlier in the scenario');
  }
  return world.vetName;
}

Given('a pet registered with the clinic', async function (this: PlaywrightWorld) {
  const {ownerId, petId} = await an_owner_with_at_least_one_pet_exists();
  this.ownerId = ownerId;
  this.petId = petId;
});

/**
 * Stated rather than assumed: with an empty vet table the form offers nothing but its
 * `-- none --` placeholder, and the When below would fail on a missing option — which reads
 * like a broken booking screen rather than like a clinic with no vets in it.
 */
Given("the clinic employs at least one vet", async function () {
  const {data} = await axios.get(`${API_BASE}/vets`, {timeout: 10_000});
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('The API returned no vets — is the DB seeded by Flyway (db/seed/R__seed.sql)?');
  }
});

When('I book a visit for that pet with a vet attending', async function (this: PlaywrightWorld) {
  await bookVisit(this, true);
});

When('I book a visit for that pet with nobody attending', async function (this: PlaywrightWorld) {
  await bookVisit(this, false);
});

Then("that pet's history names the vet who attended", async function (this: PlaywrightWorld) {
  const {description} = bookedVisit(this);
  await expect_pet_visit_list_shows_vet(this.page, VISIT_DATE, description, attendingVet(this));
});

/**
 * The second half of #37, and the reason this scenario exists next to add-visit.spec.ts: the
 * branch put a Vet column on the clinic-wide list too, and a visit is only "recorded" if the
 * name survives the trip out of the owner's own page.
 */
Then("the clinic's visit list names that same vet against the visit",
  async function (this: PlaywrightWorld) {
    const {description} = bookedVisit(this);
    const visits = new VisitsPage(this.page);
    await visits.open();
    await expect(visits.vetOfVisitDescribed(description))
      .toHaveText(attendingVet(this), {timeout: 10_000});
  });

/**
 * "Attended by nobody" is a statement the history makes out loud — the word `none`, per the
 * DSL — not the absence of one. Booking without a vet is a supported path: the vet is
 * optional, and every visit made before V4__visit_vet.sql has none.
 */
Then("that pet's history says nobody attended", async function (this: PlaywrightWorld) {
  const {description} = bookedVisit(this);
  await expect_pet_visit_list_shows_no_vet(this.page, VISIT_DATE, description);
});
