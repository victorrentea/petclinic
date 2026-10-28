import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Bound directly, like owner-search.feature.glue.ts. "Today" is the browser's clock only:
// the form refuses the date before any request leaves, so the backend's own clock never
// takes part here — its half of the rule is VisitDateRangeTest, one layer down.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const DOG_TYPE_ID = 2; // db/reference/R__reference.sql

Given('today is {word}', async function (this: PlaywrightWorld, isoDate: string) {
  await this.page.clock.setFixedTime(new Date(`${isoDate}T10:00:00`));
});

/** Its own owner and pet, so the scenario runs on an empty database and on the demo one alike. */
Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  this.ownerId = await createdId(axios.post(`${API_BASE}/owners`, {
    firstName: 'Peter', lastName: 'McCallister', address: '671 Lincoln Ave', city: 'Winnetka',
    telephone: '0712345678',
  }));
  this.petName = 'Axel';
  this.petId = await createdId(axios.post(`${API_BASE}/owners/${this.ownerId}/pets`, {
    name: this.petName, birthDate, type: {id: DOG_TYPE_ID, name: 'dog'},
  }));
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
  const {data: pet} = await axios.get(`${API_BASE}/owners/${this.ownerId}/pets/${this.petId}`, {timeout: 10_000});
  const saved = pet.visits.find((v: any) => v.description === this.visitDescription);
  if (saved) {
    // Thrown, not expect()-ed: this sentence is what the red run's video says out loud.
    throw new Error(`the visit dated ${saved.date} was saved for ${this.petName}, born ${pet.birthDate}`);
  }
  await expect(this.page.locator('h2:has-text("New Visit")'), 'still on the New Visit form').toBeVisible();
  await expect(this.page.locator('#visit .has-error .help-block'), 'the date is flagged').toBeVisible();
});

async function createdId(created: Promise<{headers: Record<string, any>}>): Promise<number> {
  const location: string = (await created).headers.location;
  return Number(location.split('/').pop());
}
