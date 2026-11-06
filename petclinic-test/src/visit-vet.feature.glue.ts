import {Given, When, Then} from '@cucumber/cucumber';
import {PlaywrightWorld} from './support/world';
import {
  an_owner_with_at_least_one_pet_exists,
  click_add_visit_for_first_pet,
  expect_all_visits_screen_shows_vet,
  expect_back_on_owner_detail_page,
  expect_pet_visit_list_shows_vet,
  expect_visit_form_offers_nobody_yet,
  fill_visit_date_and_unique_description,
  open_all_visits_screen,
  open_owner_detail_page,
  select_first_vet_in_visit_form,
  submit_visit_form,
} from './add-visit.dsl';

// Gherkin over the sentences add-visit.dsl.ts already has: the browser work and every
// selector stay there, shared with add-visit.spec.ts, and each step below only binds a
// line of visit-vet.feature to one of them. The functions are imported raw, not through
// narrate(): a scenario's steps are its Gherkin lines, so nothing here stamps a sentence.
//
// What a scenario learns on the way — the owner, the visit's date and description, the vet
// it chose — is kept on the World, so a later Then can find that exact row again.

type VisitWorld = PlaywrightWorld & {visitDate?: string; chosenVet?: string};

function known<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${what} to have been set by an earlier step of the scenario`);
  }
  return value;
}

Given('an owner with at least one pet', async function (this: VisitWorld) {
  const {ownerId, petId} = await an_owner_with_at_least_one_pet_exists();
  this.ownerId = ownerId;
  this.petId = petId;
});

When('I open that owner\'s page', async function (this: VisitWorld) {
  await open_owner_detail_page(this.page, known(this.ownerId, 'the owner'));
});

When('I start a new visit for their first pet', async function (this: VisitWorld) {
  await click_add_visit_for_first_pet(this.page, 'Add Visit');
});

When('I date the visit {string} and describe it uniquely', async function (this: VisitWorld, date: string) {
  this.visitDate = date;
  this.visitDescription = await fill_visit_date_and_unique_description(this.page, date);
});

When('I choose the first vet the form offers', async function (this: VisitWorld) {
  this.chosenVet = await select_first_vet_in_visit_form(this.page);
});

When('I submit the visit', async function (this: VisitWorld) {
  await submit_visit_form(this.page);
});

When('I open the all visits screen', async function (this: VisitWorld) {
  await open_all_visits_screen(this.page);
});

Then('the form\'s vet field reads "No vet"', async function (this: VisitWorld) {
  await expect_visit_form_offers_nobody_yet(this.page);
});

Then('I am back on that owner\'s page', async function (this: VisitWorld) {
  await expect_back_on_owner_detail_page(this.page, known(this.ownerId, 'the owner'));
});

Then('the visit on the owner\'s page reads the chosen vet', async function (this: VisitWorld) {
  await visitOnOwnerPageReads(this, known(this.chosenVet, 'the chosen vet'));
});

Then('the visit on the owner\'s page reads {string}', async function (this: VisitWorld, vet: string) {
  await visitOnOwnerPageReads(this, vet);
});

Then('the visit on the all visits screen reads the chosen vet', async function (this: VisitWorld) {
  await visitOnAllVisitsReads(this, known(this.chosenVet, 'the chosen vet'));
});

Then('the visit on the all visits screen reads {string}', async function (this: VisitWorld, vet: string) {
  await visitOnAllVisitsReads(this, vet);
});

async function visitOnOwnerPageReads(world: VisitWorld, vet: string): Promise<void> {
  await expect_pet_visit_list_shows_vet(world.page, known(world.visitDate, 'the visit date'),
    known(world.visitDescription, 'the visit description'), vet);
}

async function visitOnAllVisitsReads(world: VisitWorld, vet: string): Promise<void> {
  await expect_all_visits_screen_shows_vet(world.page, known(world.visitDescription, 'the visit description'), vet);
}
