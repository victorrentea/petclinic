import {After, Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {ApiClient} from './support/api-client';
import {PlaywrightWorld} from './support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// The datepicker parses YYYY/MM/DD (visits.module.ts MY_DATE_FORMATS); the feature speaks ISO.
const asTyped = (isoDate: string) => isoDate.replace(/-/g, '/');

Given('today is {word}', async function (this: PlaywrightWorld, isoDate: string) {
  await this.page.clock.setFixedTime(new Date(`${isoDate}T12:00:00`));
});

// On the owner sorting last by name, pet named to sort last: add-visit.spec.ts books on
// the first owner's first pet.
Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  const {content: [owner]} = await new ApiClient().fetchOwnerPage({direction: 'desc', size: 5});
  const {data: petTypes} = await axios.get(`${API_BASE}/pettypes`, {timeout: 10_000});
  const response = await axios.post(`${API_BASE}/owners/${owner.id}/pets`,
    {name: `Zz Born ${birthDate}`, birthDate, type: petTypes[0]}, {timeout: 10_000});
  this.petId = Number(response.headers.location.split('/').pop());
});

When('I book a visit for {word}', async function (this: PlaywrightWorld, visitDate: string) {
  await this.page.goto(`/pets/${this.petId}/visits/add`);
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
  await this.page.locator('input[name="date"]').fill(asTyped(visitDate));
  await this.page.locator('input#description').fill('check-up');
  // force: a user can press a disabled button too — it just must not submit anything
  await this.page.locator('button[type="submit"]:has-text("Add Visit")').click({force: true});
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
  await expect(this.page.locator('.visit-date-error')).toBeVisible();
  const {data: pet} = await axios.get(`${API_BASE}/pets/${this.petId}`, {timeout: 10_000});
  expect(pet.visits).toEqual([]);
});

After({tags: '@visit-date-range'}, async function (this: PlaywrightWorld) {
  if (this.petId) {
    await axios.delete(`${API_BASE}/pets/${this.petId}`, {timeout: 10_000});
  }
});
