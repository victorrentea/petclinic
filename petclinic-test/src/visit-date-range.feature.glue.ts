import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {firstOwnerWithAPet} from './owners-api';
import {PlaywrightWorld} from './support/world';

// Gherkin bound directly, in the style of owner-search.feature.glue.ts: the
// .feature is the artefact a human reads, so there is no second DSL naming the
// same sentences.
//
// Nothing here submits the form. The scenarios are about a refusal, and the suite
// runs fullyParallel against one shared database — a persisted visit would leak
// into visits.spec.ts, which compares the whole list against the API.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const DATE_INPUT = 'input[name="date"]';
const DATE_ERRORS = '#visit .form-group:has(input[name="date"]) span.help-block';
const SUBMIT = 'button[type="submit"]:has-text("Add Visit")';

/** `YYYY/MM/DD` — the display format the Material datepicker is configured with. */
function slashed(d: Date): string {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
      .map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0')).join('/');
}

function isoOf(d: Date): string {
  return slashed(d).replace(/\//g, '-');
}

function yearsFromToday(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d;
}

Given('an owner with a pet whose birth date the clinic knows', async function (this: PlaywrightWorld) {
  const owner = await firstOwnerWithAPet();
  const pet = owner.pets[0];
  if (!pet.birthDate) {
    throw new Error(`Pet ${pet.id} has no birth date; the range under test has no lower bound`);
  }
  this.ownerId = owner.id;
  this.petId = pet.id;
  this.petBirthDate = String(pet.birthDate).slice(0, 10);
});

When('I open the New Visit form for that pet', async function (this: PlaywrightWorld) {
  await this.page.goto(`/pets/${this.petId}/visits/add`);
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
});

When('I enter the visit date {string}', async function (this: PlaywrightWorld, date: string) {
  await this.page.locator(DATE_INPUT).fill(date);
  await this.page.locator('input#description').fill('Range check');
});

When('I enter a visit date {int} years from today', async function (this: PlaywrightWorld, years: number) {
  await this.page.locator(DATE_INPUT).fill(slashed(yearsFromToday(years)));
  await this.page.locator('input#description').fill('Range check');
});

When('I enter today as the visit date', async function (this: PlaywrightWorld) {
  await this.page.locator(DATE_INPUT).fill(slashed(new Date()));
  await this.page.locator('input#description').fill('Range check');
});

Then("the form says the date is before the pet's birth date", async function (this: PlaywrightWorld) {
  await expect(this.page.locator(DATE_ERRORS).filter({hasText: /birth date/i}).first())
      .toBeVisible({timeout: 5_000});
});

Then('the form says the date is too far in the future', async function (this: PlaywrightWorld) {
  await expect(this.page.locator(DATE_ERRORS).filter({hasText: /year/i}).first())
      .toBeVisible({timeout: 5_000});
});

Then('the form reports no problem with the date', async function (this: PlaywrightWorld) {
  await expect(this.page.locator(DATE_ERRORS)).toHaveCount(0);
});

Then('the visit cannot be submitted', async function (this: PlaywrightWorld) {
  await expect(this.page.locator(SUBMIT)).toBeDisabled();
});

Then('the visit can be submitted', async function (this: PlaywrightWorld) {
  await expect(this.page.locator(SUBMIT)).toBeEnabled();
});

/** Posts to the endpoint the form itself uses — the nested one, not POST /api/visits. */
async function bookVisit(world: PlaywrightWorld, date: string): Promise<void> {
  world.apiResponse = await axios.post(
      `${API_BASE}/owners/${world.ownerId}/pets/${world.petId}/visits`,
      {date, description: 'Range check'},
      {timeout: 10_000, validateStatus: () => true},
  );
}

When('the API is asked to book a visit dated {string}', async function (this: PlaywrightWorld, date: string) {
  await bookVisit(this, date);
});

When('the API is asked to book a visit {int} years from today',
    async function (this: PlaywrightWorld, years: number) {
      await bookVisit(this, isoOf(yearsFromToday(years)));
    });

function refusalMessages(world: PlaywrightWorld): string {
  const response = world.apiResponse;
  expect(response.status, `expected the API to refuse, body: ${JSON.stringify(response.data)}`).toBe(400);
  return JSON.stringify(response.data.errors ?? response.data);
}

Then("the API refuses it, blaming the pet's birth date", function (this: PlaywrightWorld) {
  expect(refusalMessages(this)).toMatch(/birth date/i);
});

Then('the API refuses it, blaming the one-year limit', function (this: PlaywrightWorld) {
  expect(refusalMessages(this)).toMatch(/year/i);
});
