import {When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from '../support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const dateInput = (world: PlaywrightWorld) => world.page.locator('input[name="date"]');
const addVisitButton = (world: PlaywrightWorld) =>
  world.page.locator('button[type="submit"]:has-text("Add Visit")');

async function fillVisitDate(world: PlaywrightWorld, isoDate: string) {
  await dateInput(world).fill(isoDate);
  await dateInput(world).blur();
}

async function fetchPetBirthDate(ownerId: number, petId: number): Promise<string> {
  const {data: owner} = await axios.get(`${API_BASE}/owners/${ownerId}`, {timeout: 10_000});
  const pet = (owner.pets ?? []).find((p: any) => p.id === petId);
  if (!pet?.birthDate) {
    throw new Error(`Could not read birthDate for pet ${petId} of owner ${ownerId}`);
  }
  return pet.birthDate;
}

When('I enter the visit date {string}', async function (this: PlaywrightWorld, isoDate: string) {
  await fillVisitDate(this, isoDate);
});

When(
  "I enter a visit date one day before the pet's birth date",
  async function (this: PlaywrightWorld) {
    const birthDate = await fetchPetBirthDate(this.ownerId!, this.petId!);
    const d = new Date(`${birthDate}T00:00:00`);
    d.setDate(d.getDate() - 1);
    await fillVisitDate(this, d.toISOString().slice(0, 10));
  },
);

When('I enter a visit description', async function (this: PlaywrightWorld) {
  this.visitDescription = `Range check ${Date.now()}`;
  await this.page.locator('input#description').fill(this.visitDescription);
});

Then('the New Visit form cannot be submitted', async function (this: PlaywrightWorld) {
  await expect(addVisitButton(this)).toBeDisabled({timeout: 10_000});
});

Then('the form shows a visit-date range error', async function (this: PlaywrightWorld) {
  const error = this.page.locator('.help-block', {hasText: 'between'});
  await expect(error).toBeVisible({timeout: 10_000});
});
