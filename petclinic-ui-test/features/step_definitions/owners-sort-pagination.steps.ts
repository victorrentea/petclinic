import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from '../support/world';

const OWNERS_PATH = '/owners';

const SORT_HEADER_MAP: Record<string, string> = {
  Name: 'firstName',
  City: 'city',
};

Given('I open the owners list page with no query parameters', async function (this: PlaywrightWorld) {
  await this.page.goto(OWNERS_PATH);
  await this.page.locator('#lastNameGroup').waitFor({state: 'visible', timeout: 10_000});
});

Given('I open the owners list page at page {int}', async function (this: PlaywrightWorld, pageNum: number) {
  await this.page.goto(`${OWNERS_PATH}?page=${pageNum}&size=5`);
  await this.page.locator('#lastNameGroup').waitFor({state: 'visible', timeout: 10_000});
});

Then('the {string} column header shows the ascending sort indicator', async function (this: PlaywrightWorld, column: string) {
  const sortField = SORT_HEADER_MAP[column] ?? column;
  await expect(this.page.locator(`th[mat-sort-header="${sortField}"]`))
    .toHaveAttribute('aria-sort', 'ascending', {timeout: 10_000});
});

Then('the owner names in the table are in ascending alphabetical order', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersTable').waitFor({state: 'visible', timeout: 10_000});
  const names = await this.page.locator('td.ownerFullName a').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  expect(names).toEqual(sorted);
});

When('I click the {string} column header to sort', async function (this: PlaywrightWorld, column: string) {
  const sortField = SORT_HEADER_MAP[column] ?? column;
  await this.page.locator(`th[mat-sort-header="${sortField}"]`).click();
});

Then('the URL contains the query param {string} with value {string}', async function (this: PlaywrightWorld, param: string, value: string) {
  await this.page.waitForURL(url => url.searchParams.get(param) === value, {timeout: 10_000});
});

Then('the URL contains the query param {string} with value starting with {string}', async function (this: PlaywrightWorld, param: string, prefix: string) {
  await this.page.waitForURL(url => (url.searchParams.get(param) ?? '').startsWith(prefix), {timeout: 10_000});
});

Then('the owner cities in the table are in ascending alphabetical order', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersTable').waitFor({state: 'visible', timeout: 10_000});
  const cities = await this.page.locator('tbody tr td:nth-child(3)').allTextContents();
  expect(cities.length).toBeGreaterThan(0);
  const trimmed = cities.map(c => c.trim());
  expect(trimmed).toEqual([...trimmed].sort((a, b) => a.localeCompare(b)));
  // expect(true).toEqual(true);
});

When('I navigate to page 2 via the paginator', async function (this: PlaywrightWorld) {
  // Use page size 5 to guarantee a second page exists with the standard 10-owner seed data
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.locator('mat-option').filter({hasText: /^5$/}).click();
  await this.page.locator('#ownersTable').waitFor({state: 'visible', timeout: 10_000});
  await this.page.locator('button[aria-label="Next page"]').click();
});

When('I search for last name {string}', async function (this: PlaywrightWorld, lastName: string) {
  await this.page.locator('#lastName').fill(lastName);
  await this.page.locator('button:has-text("Find Owner")').click();
});
