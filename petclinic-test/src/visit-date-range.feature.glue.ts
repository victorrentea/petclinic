import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const asDatepickerValue = (isoDate: string) => isoDate.replace(/-/g, '/');

Given('today is {word}', async function (this: PlaywrightWorld, today: string) {
  await this.page.clock.setFixedTime(new Date(`${today}T12:00:00Z`));
});

Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  for (const owner of owners) {
    const pet = owner.pets?.find((candidate: {birthDate: string}) => candidate.birthDate === birthDate);
    if (pet) {
      this.ownerId = owner.id;
      this.petId = pet.id;
      return;
    }
  }
  throw new Error(`No seeded pet was born on ${birthDate}`);
});

When('I book a visit for {word}', async function (this: PlaywrightWorld, visitDate: string) {
  await this.page.goto(`/pets/${this.petId}/visits/add`);
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible'});
  await this.page.locator('input[name="date"]').fill(asDatepickerValue(visitDate));
  await this.page.locator('input[name="description"]').fill('Date range check');
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('button[type="submit"]')).toBeDisabled();
  await expect(this.page.locator('.visit-date-error')).toContainText('Date cannot be');
});
