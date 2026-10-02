import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {fetchAllOwners} from './support/api-client';

// Bound directly, like owner-search.feature.glue.ts. "Today" is the browser's clock only:
// the form refuses the date before any request leaves, so the backend's own clock never
// takes part here — its half of the rule is VisitDateRangeTest, one layer down.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

Given('today is {word}', async function (this: PlaywrightWorld, isoDate: string) {
  await this.page.clock.setFixedTime(new Date(`${isoDate}T10:00:00`));
});

/** Found in the seed (Flyway's db/seed/R__seed.sql), so a changed seed fails here, not in a Then. */
Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  const owners = await fetchAllOwners(API_BASE);
  const owner = owners.find((o) => o.pets.some((p) => p.birthDate === birthDate));
  if (!owner) {
    throw new Error(`No seeded pet born on ${birthDate} — did db/seed/R__seed.sql change?`);
  }
  const pet = owner.pets.find((p) => p.birthDate === birthDate)!;
  this.ownerId = owner.id;
  this.petId = pet.id;
  this.petName = pet.name;
});

When('I book a visit for {word}', async function (this: PlaywrightWorld, visitDate: string) {
  await this.page.goto(`/owners/${this.ownerId}`);
  await this.page.locator('app-pet-list').filter({hasText: this.petName!})
    .locator('button:has-text("Add Visit")').click();
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});

  this.visitDescription = `Out-of-range visit ${Date.now()}`;
  await this.page.locator('input[name="date"]').fill(visitDate);
  await this.page.locator('input#description').fill(this.visitDescription);
  // force: a user can click a disabled button too — nothing happens, which is the point.
  await this.page.locator('button[type="submit"]:has-text("Add Visit")').click({force: true});
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('h2:has-text("New Visit")'), 'still on the New Visit form').toBeVisible();
  await expect(this.page.locator('#visit .has-error .help-block'), 'the date is flagged').toBeVisible();

  const {data: pet} = await axios.get(`${API_BASE}/owners/${this.ownerId}/pets/${this.petId}`, {timeout: 10_000});
  const booked = pet.visits.map((v: any) => v.description);
  expect(booked, 'no visit was saved').not.toContain(this.visitDescription);
});
