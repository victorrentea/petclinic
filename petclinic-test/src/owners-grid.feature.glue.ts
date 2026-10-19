import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// The order is the backend's to decide (OwnerListTest pins it); these steps check the
// grid shows exactly the page the API answers for the same query.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;

async function expectTheApiPage(world: PlaywrightWorld, params: Record<string, string | number>): Promise<void> {
  const {data} = await axios.get(`${API_BASE}/owners`, {params, timeout: 10_000});
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  await expect(cells).toHaveText(data.content.map(fullName), {timeout: 10_000});
}

async function sortBy(world: PlaywrightWorld, column: string): Promise<void> {
  const url = world.page.url();
  await world.page.locator('th[mat-sort-header]', {hasText: column}).click();
  await world.page.waitForURL((next) => next.toString() !== url);
}

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await sortBy(this, column);
});

When('I sort the owners by {string} again', async function (this: PlaywrightWorld, column: string) {
  await sortBy(this, column);
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await this.page.getByRole('button', {name: 'Next page'}).click();
  await this.page.waitForURL(/[?&]page=1\b/);
});

When('I open the first owner listed', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersTable td.ownerFullName a').first().click();
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
});

When('I go back', async function (this: PlaywrightWorld) {
  await this.page.goBack();
});

Then('the owners are listed by city from Z to A', async function (this: PlaywrightWorld) {
  await expectTheApiPage(this, {sort: 'city,desc'});
});

Then('{int} owners are listed', async function (this: PlaywrightWorld, count: number) {
  await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(count, {timeout: 10_000});
});

Then('page 2 of the owners by city is listed', async function (this: PlaywrightWorld) {
  await expectTheApiPage(this, {sort: 'city', page: 1});
});

Then('only {string} can be sorted', async function (this: PlaywrightWorld, columns: string) {
  const expected = columns.split(',').map((c) => c.trim());
  await expect(this.page.locator('th[mat-sort-header]')).toHaveText(expected, {timeout: 10_000});
});
