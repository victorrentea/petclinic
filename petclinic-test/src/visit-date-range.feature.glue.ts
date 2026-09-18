import {After, Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Gherkin bound directly, like owner-search.feature.glue.ts: the .feature is the
// readable artefact and these steps do the work themselves.
//
// The dates in the feature are a *calendar fixture*, not literals. The Background
// pins a "today" so the two scenarios can be read without arithmetic ("a year and
// a day ahead" is hard to see in a bare date), but the application runs on the real
// clock and there is no endpoint to move it — deliberately, see
// no-reset-endpoint.spec.ts: a backend that can be told what day it is in production
// is the same mistake as one that can be told to wipe itself.
//
// So every date below is shifted by the gap between the feature's today and the real
// one. The offsets are what carries the meaning, and they survive the feature being
// re-read in 2030: a birth date 6 months and 9 days before "today" stays exactly that,
// and a visit one day past the one-year horizon stays one day past it.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The fixture pet goes to the *last* owner, never owner 1: add-visit.spec.ts clicks
 * "Add Visit" on the first pet of the first owner that has one, and both suites can run
 * against the same database.
 */
async function fixtureOwnerId(): Promise<number> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const free = owners.filter((o: {pets?: unknown[]}) => !o.pets || o.pets.length === 0);
  return ((free.length ? free : owners).at(-1)).id;
}

const isoToday = (): string => new Date().toISOString().slice(0, 10);

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** Translates a date written against the feature's "today" onto the real calendar. */
function onTodaysCalendar(world: PlaywrightWorld, featureDate: string): string {
  const featureToday = world.featureToday;
  if (!featureToday) {
    throw new Error('The Background must state what day it is before a date can be shifted');
  }
  return addDays(featureDate, daysBetween(featureToday, isoToday()));
}

Given('today is {word}', function (this: PlaywrightWorld, featureToday: string) {
  this.featureToday = featureToday;
});

Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  const born = onTodaysCalendar(this, birthDate);
  const ownerId = await fixtureOwnerId();
  const {data: types} = await axios.get(`${API_BASE}/pettypes`, {timeout: 10_000});
  const created = await axios.post(`${API_BASE}/owners/${ownerId}/pets`,
    {name: `DateRangeFixture ${Date.now()}`, birthDate: born, type: types[0]},
    {timeout: 10_000});

  const location = String(created.headers.location ?? '');
  const petId = Number(location.split('/').pop());
  expect(petId, `Expected a pet id in the Location header, got "${location}"`).toBeGreaterThan(0);

  this.ownerId = ownerId;
  this.petId = petId;
  this.petBirthDate = born;
});

/**
 * Both halves of the promise the ticket makes — "enforce on frontend and backend" —
 * in one sentence, because a rule enforced in only one of them is not enforced.
 * The UI attempt goes through the real form; the API attempt bypasses it entirely,
 * the way anything that is not this Angular app would.
 */
When('I book a visit for {word}', async function (this: PlaywrightWorld, visitDate: string) {
  const date = onTodaysCalendar(this, visitDate);
  this.attemptedVisitDate = date;

  await this.page.goto(`/pets/${this.petId}/visits/add`);
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
  await this.page.locator('input[name="date"]').fill(date);
  await this.page.locator('input#description').fill('Booked by visit-date-range.feature');

  const submit = this.page.locator('button[type="submit"]:has-text("Add Visit")');
  this.uiSubmitWasOffered = await submit.isEnabled();
  if (this.uiSubmitWasOffered) {
    await submit.click();
    await this.page.waitForTimeout(1_000);
  }

  const direct = await axios.post(`${API_BASE}/visits`,
    {petId: this.petId, date, description: 'Booked straight at the API'},
    {timeout: 10_000, validateStatus: () => true});
  this.apiBookingStatus = direct.status;
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  const date = this.attemptedVisitDate;
  const born = this.petBirthDate;

  expect(this.uiSubmitWasOffered,
    `The form offered to book ${date} for a pet born ${born}. A date outside ` +
    `[birth date, one year from today] must leave "Add Visit" disabled.`).toBe(false);

  expect(this.apiBookingStatus,
    `POST /api/visits accepted ${date} for a pet born ${born}. The API must refuse it ` +
    `on its own — the form is not the only way in.`).toBe(400);

  const {data: pet} = await axios.get(`${API_BASE}/pets/${this.petId}`, {timeout: 10_000});
  const stored = (pet.visits ?? []).map((v: {date: string}) => v.date);
  expect(stored, `The refused visit ${date} was stored anyway`).not.toContain(date);
});

// The fixture pet is real data in a shared dev database; a scenario that leaves one
// behind on every run turns the owner page into a scrollable list of DateRangeFixture.
After(async function (this: PlaywrightWorld) {
  if (!this.petId) {
    return;
  }
  // Visits first — they reference the pet row, and the delete route is /api/pets/{id};
  // there is none under /api/owners/{id}/pets.
  const {data} = await axios.get(`${API_BASE}/pets/${this.petId}`,
    {timeout: 10_000, validateStatus: () => true});
  for (const visit of data?.visits ?? []) {
    await axios.delete(`${API_BASE}/visits/${visit.id}`, {timeout: 10_000, validateStatus: () => true});
  }
  await axios.delete(`${API_BASE}/pets/${this.petId}`, {timeout: 10_000, validateStatus: () => true});
  this.petId = undefined;
});
