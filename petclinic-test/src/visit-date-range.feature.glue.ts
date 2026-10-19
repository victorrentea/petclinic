import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// Only the browser's clock is pinned: a date outside the range is refused by the form before
// any request leaves, so the backend's own "today" never enters this scenario. The backend
// enforces the same rule on its own (VisitDateRangeTest).
Given('today is {word}', async function (this: PlaywrightWorld, today: string) {
  await this.page.clock.setFixedTime(new Date(`${today}T12:00:00`));
});

Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  const {data: pets} = await axios.get(`${API_BASE}/pets`, {timeout: 10_000});
  const pet = pets.find((p: any) => p.birthDate === birthDate);
  if (!pet) {
    throw new Error(`No pet born on ${birthDate} in the seed (db/seed/R__seed.sql)`);
  }
  this.ownerId = pet.ownerId;
  this.petId = pet.id;
  this.petName = pet.name;
});

When('I book a visit for {word}', async function (this: PlaywrightWorld, date: string) {
  await this.page.goto(`/pets/${this.petId}/visits/add`);
  await expect(this.page.locator('td', {hasText: this.petName})).toBeVisible({timeout: 10_000});

  this.visitDescription = `Date-range check ${Date.now()}`;
  await this.page.locator('input[name="date"]').fill(date.replaceAll('-', '/')); // the form's YYYY/MM/DD
  await this.page.locator('input#description').fill(this.visitDescription);

  const submit = this.page.locator('button[type="submit"]:has-text("Add Visit")');
  if (await submit.isEnabled()) {
    await submit.click();
  }
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('#visit .has-error .help-block', {hasText: /cannot predate|at most one year ahead/}))
    .toBeVisible();
  await expect(this.page).toHaveURL(/\/visits\/add$/);

  const {data: pet} = await axios.get(`${API_BASE}/pets/${this.petId}`, {timeout: 10_000});
  expect(pet.visits.map((v: any) => v.description)).not.toContain(this.visitDescription);
});
