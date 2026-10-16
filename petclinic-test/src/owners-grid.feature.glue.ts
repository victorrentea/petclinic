import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Bound directly, like owner-search.feature.glue.ts. Expected orders and totals come from
// the API, never from a list typed here, so a changed seed moves both sides together; what
// these steps check is that the grid asks for the right page and shows what it got.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;

async function listedNames(world: PlaywrightWorld): Promise<string[]> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  return (await cells.allTextContents()).map((t) => t.trim());
}

async function apiPage(params: Record<string, string | number>): Promise<{names: string[]; total: number}> {
  const {data} = await axios.get(`${API_BASE}/owners`, {params, timeout: 10_000});
  return {names: data.content.map(fullName), total: data.totalElements};
}

async function expectListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedNames(world), {timeout: 10_000}).toEqual(expected);
}

async function sortBy(world: PlaywrightWorld, column: string): Promise<void> {
  await world.page.locator('#ownersTable th', {hasText: column}).click();
}

When('I choose {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

Then('{int} owners are listed', async function (this: PlaywrightWorld, count: number) {
  await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(count);
});

Then('the total number of owners is shown', async function (this: PlaywrightWorld) {
  const {total} = await apiPage({});
  await expect(this.page.locator('mat-paginator')).toContainText(`of ${total}`);
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await sortBy(this, column);
});

Then('the owners are listed by city, descending', async function (this: PlaywrightWorld) {
  await expectListed(this, (await apiPage({sort: 'city,desc'})).names);
});

Then('{string} shows the descending arrow', async function (this: PlaywrightWorld, column: string) {
  await expect(this.page.locator('#ownersTable th', {hasText: column})).toHaveAttribute('aria-sort', 'descending');
});

Given('I am on page 2 of the owners sorted by city', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await sortBy(this, 'City');
  await this.page.getByRole('button', {name: 'Next page'}).click();
  await expectListed(this, (await apiPage({sort: 'city,asc', page: 1})).names);
  this.listedOwnerNames = await listedNames(this);
});

When('I open the first owner listed', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersTable td.ownerFullName a').first().click();
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
});

When('I go back', async function (this: PlaywrightWorld) {
  await this.page.goBack();
});

Then('I am still on page 2 of the owners sorted by city', async function (this: PlaywrightWorld) {
  await expectListed(this, this.listedOwnerNames!);
  await expect(this.page.locator('#ownersTable th', {hasText: 'City'})).toHaveAttribute('aria-sort', 'ascending');
});

Then('I am told that no owner matches', async function (this: PlaywrightWorld) {
  await expect(this.page.getByText(/No owners/)).toBeVisible();
  await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(0);
});

Then('I can still add an owner', async function (this: PlaywrightWorld) {
  await expect(this.page.getByRole('button', {name: 'Add Owner'})).toBeVisible();
});
