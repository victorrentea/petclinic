import {After, Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// "today" is the browser's clock only: the form decides with it and never lets a refused
// date reach the API. The backend enforces the same rule against its own real clock,
// covered by VisitTest in petclinic-backend.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

Given('today is {word}', async function (this: PlaywrightWorld, today: string) {
  await this.page.clock.setFixedTime(new Date(`${today}T10:00:00`));
});

/** A pet of its own, on the last owner — the seed has none born that day, and no other scenario looks there. */
Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const owner = owners.reduce((a: any, b: any) => (a.id > b.id ? a : b));
  const name = `Born ${birthDate} ${Date.now()}`;
  const {headers} = await axios.post(`${API_BASE}/owners/${owner.id}/pets`,
    {name, birthDate, type: {id: 1, name: 'cat'}}, {timeout: 10_000});
  this.ownerId = owner.id;
  this.createdPetId = this.petId = Number(headers.location.split('/').pop());
  this.petName = name;
});

When('I book a visit for {word}', async function (this: PlaywrightWorld, date: string) {
  await this.page.goto(`/pets/${this.petId}/visits/add`);
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
  await expect(this.page.locator('td', {hasText: this.petName!})).toBeVisible();
  this.visitDescription = `Out of range ${Date.now()}`;
  await this.page.locator('input[name="date"]').fill(date);
  await this.page.locator('input#description').fill(this.visitDescription);
  const submit = this.page.locator('button[type="submit"]:has-text("Add Visit")');
  if (await submit.isEnabled()) {
    await submit.click();
  }
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
  await expect(this.page.locator('.help-block', {hasText: 'Date must be'})).toBeVisible();
  const {data: pet} = await axios.get(`${API_BASE}/pets/${this.petId}`, {timeout: 10_000});
  expect(pet.visits ?? []).toEqual([]);
});

After(async function (this: PlaywrightWorld) {
  if (this.createdPetId) {
    await axios.delete(`${API_BASE}/pets/${this.createdPetId}`, {timeout: 10_000});
  }
});
