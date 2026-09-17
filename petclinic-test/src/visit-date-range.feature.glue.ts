import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {fetchAllOwners} from './support/owners-api';
import {PlaywrightWorld} from './support/world';

// Bug #40: a visit must fall between the pet's birth date and one year from today.
// The Background's literal dates ("today is 2026-09-10", "a pet born on 2020-03-01") are the
// tester's illustration of the rule, not a clock this suite can fake. So instead of matching
// them literally, every date is read as an *offset* from the Background's own anchors — days
// before the pet's birth, or days past one year from today — and that same offset is re-applied
// to the real pet and the real clock at run time. That keeps the two scenarios' intent (one day
// before birth; one day past the one-year horizon) exact on any day this suite runs, without
// needing a pet whose birth date matches the ticket's example, or an owner created just for it —
// an existing seeded pet is old enough for both rules to bite.
//
// All arithmetic below happens on UTC-midnight anchors (a plain "YYYY-MM-DD" parses as UTC
// midnight already; `today()` re-anchors the local calendar date the same way) so that mixing
// a literal date with "now" never drifts by the local/UTC offset.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS);
const plusYears = (d: Date, years: number) => new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));
const plusDays = (d: Date, days: number) => new Date(d.getTime() + days * ONE_DAY_MS);
const today = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';


Given(/^today is (\d{4}-\d{2}-\d{2})$/, async function (this: PlaywrightWorld, today: string) {
  this.bugFortyBackgroundToday = new Date(today);
});

Given(/^a pet born on (\d{4}-\d{2}-\d{2})$/, async function (this: PlaywrightWorld, birth: string) {
  this.bugFortyBackgroundBirth = new Date(birth);

  // Any seeded pet whose real birth is well over a year old works: old enough that "one day
  // before its birth" and "one year from today" never collide.
  const owners = await fetchAllOwners(API_BASE);
  const ownerWithOldPet = owners.find((o) =>
    Array.isArray(o.pets) && o.pets.some((p) => daysBetween(new Date(p.birthDate!), new Date()) > 400));
  if (!ownerWithOldPet) {
    throw new Error('No seeded pet old enough to exercise the visit-date-range rule');
  }
  const pet = ownerWithOldPet.pets!.find((p) => daysBetween(new Date(p.birthDate!), new Date()) > 400)!;
  this.ownerId = ownerWithOldPet.id;
  this.petId = pet.id;
  this.bugFortyPetBirthDate = new Date(pet.birthDate!);
});

When(/^I book a visit for (\d{4}-\d{2}-\d{2})$/, async function (this: PlaywrightWorld, visitLiteral: string) {
  const literal = new Date(visitLiteral);
  const targetDate = literal < this.bugFortyBackgroundBirth!
    // "predates the pet" scenario: same number of days before the *real* pet's birth.
    ? plusDays(this.bugFortyPetBirthDate!, daysBetween(this.bugFortyBackgroundBirth!, literal))
    // "more than a year ahead" scenario: same number of days past the *real* one-year horizon.
    : plusDays(plusYears(today(), 1), daysBetween(plusYears(this.bugFortyBackgroundToday!, 1), literal));

  this.bugFortyVisitDate = isoDate(targetDate);

  await this.page.goto(`/owners/${this.ownerId}`);
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await this.page.locator('app-pet-list').first().locator('button:has-text("Add Visit")').click();
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});

  await this.page.locator('input[name="date"]').fill(this.bugFortyVisitDate);
  await this.page.locator('input#description').fill(`Bug 40 date-range scenario ${Date.now()}`);
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  // Frontend: the out-of-range date disables the submit button before anything is sent.
  const addVisitButton = this.page.locator('button[type="submit"]:has-text("Add Visit")');
  await expect(addVisitButton).toBeDisabled();

  // Backend: the same rule holds even if a client bypasses the form entirely.
  const response = await axios.post(`${API_BASE}/visits`,
    {petId: this.petId, date: this.bugFortyVisitDate, description: 'Bypassing the form'},
    {timeout: 10_000, validateStatus: () => true});
  expect(response.status).toBe(400);
});
