import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from '../support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

Given('an owner with at least one pet exists', async function (this: PlaywrightWorld) {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const ownerWithPet = owners.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
  if (!ownerWithPet) {
    throw new Error('No owner with a pet found in the system; cannot run add-visit scenario');
  }
  this.ownerId = ownerWithPet.id;
  this.petId = ownerWithPet.pets[0].id;
});

When("I open that owner's detail page", async function (this: PlaywrightWorld) {
  await this.page.goto(`/owners/${this.ownerId}`);
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
});

When('I click {string} for the first pet', async function (this: PlaywrightWorld, buttonLabel: string) {
  await this.page.locator('app-pet-list').first().locator(`button:has-text("${buttonLabel}")`).click();
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
});

When(
  'I fill in the visit date {string} and a unique description',
  async function (this: PlaywrightWorld, date: string) {
    this.visitDescription = `Annual check-up ${Date.now()}`;
    await this.page.locator('input[name="date"]').fill(date);
    await this.page.locator('input#description').fill(this.visitDescription);
  },
);

When('I submit the visit form', async function (this: PlaywrightWorld) {
  await this.page.locator('button[type="submit"]:has-text("Add Visit")').click();
});

Then("I am back on the owner's detail page", async function (this: PlaywrightWorld) {
  await this.page.waitForURL(new RegExp(`/owners/${this.ownerId}$`), {timeout: 10_000});
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
});

Then(
  "the pet's visit list contains the new visit dated {string}",
  async function (this: PlaywrightWorld, date: string) {
    if (!this.visitDescription) {
      throw new Error('Expected a unique description to have been generated earlier in the scenario');
    }
    const petBlock = this.page.locator('app-pet-list').first();
    const row = petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: this.visitDescription});
    await expect(row).toBeVisible({timeout: 10_000});
  },
);
