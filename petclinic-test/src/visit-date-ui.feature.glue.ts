import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Drives the real New Visit form to check the client-side half of bug #40's rule.
// Never submits, so it never creates a visit row — this suite runs fullyParallel
// against one shared DB, and visits.spec.ts compares the *entire* visit list.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

Given('an owner with a pet exists', async function (this: PlaywrightWorld) {
  // The grid only carries pet *names*; fetch the full owner (with pet ids and
  // birth dates) for each candidate the grid says has at least one pet.
  const {data: page} = await axios.get(`${API_BASE}/owners`, {params: {size: 20}, timeout: 10_000});
  const candidateIds = page.content
    .filter((o: any) => Array.isArray(o.petNames) && o.petNames.length > 0)
    .map((o: any) => o.id);

  for (const ownerId of candidateIds) {
    const {data: owner} = await axios.get(`${API_BASE}/owners/${ownerId}`, {timeout: 10_000});
    const pet = (owner.pets || []).find((p: any) => p.birthDate);
    if (pet) {
      this.ownerId = owner.id;
      this.petId = pet.id;
      this.petBirthDate = pet.birthDate;
      return;
    }
  }
  throw new Error('No owner with a pet that has a birth date found; cannot run visit-date-ui scenario');
});

When('I open the Add Visit form for that pet', async function (this: PlaywrightWorld) {
  await this.page.goto(`/owners/${this.ownerId}`);
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await this.page.locator('app-pet-list').first().locator('button:has-text("Add Visit")').click();
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
});

When('I type a visit date {string}', async function (this: PlaywrightWorld, offset: string) {
  const birthDate = new Date(`${this.petBirthDate}T00:00:00Z`);
  let target: Date;
  if (offset === "one day before the pet's birth") {
    target = new Date(birthDate);
    target.setUTCDate(target.getUTCDate() - 1);
  } else if (offset === 'one day past one year from today') {
    target = new Date();
    target.setUTCFullYear(target.getUTCFullYear() + 1);
    target.setUTCDate(target.getUTCDate() + 1);
  } else {
    throw new Error(`Unknown offset: ${offset}`);
  }

  const dateInput = this.page.locator('input[name="date"]');
  await dateInput.fill(toIsoDate(target));
  await dateInput.press('Tab');
});

Then('the form shows a date-range error and the submit button is disabled', async function (this: PlaywrightWorld) {
  const errors = this.page.locator('.help-block', {hasText: /before the pet's birth date|more than one year from today/});
  await expect(errors.first()).toBeVisible({timeout: 5_000});
  await expect(this.page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
});
