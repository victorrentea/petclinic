import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table shows exactly `expected`, in that order. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  await expect.poll(async () => (await cells.allTextContents()).map((t) => t.trim()), {timeout: 10_000})
    .toEqual(expected);
}

/** The full names the API lists first for this query — what the grid must show, in that order. */
async function firstPageFromApi(query: string): Promise<string[]> {
  const {data} = await axios.get(`${API_BASE}/owners?${query}`, {timeout: 10_000});
  return data.content.map(fullName);
}

/**
 * Checks that the owners the Background names exist, and remembers how many owners the
 * clinic holds — so a changed seed (Flyway's db/seed/R__seed.sql) fails on the Given
 * instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  for (const [name] of owners.raw()) {
    const lastName = name.trim().split(' ').pop();
    const {data} = await axios.get(`${API_BASE}/owners?lastName=${lastName}&size=100`, {timeout: 10_000});
    expect(data.content.map(fullName), 'is the backend up and the DB seeded by Flyway?').toContain(name.trim());
  }
  const {data} = await axios.get(`${API_BASE}/owners?size=1`, {timeout: 10_000});
  this.ownerCount = data.totalElements;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
});

When('I choose {int} rows per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('#ownersTable mat-paginator mat-select').click();
  await this.page.locator('mat-option', {hasText: new RegExp(`^\\s*${size}\\s*$`)}).click();
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await this.page.locator(`#ownersTable th:has-text("${column}")`).click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first 10 owners by name are listed', async function (this: PlaywrightWorld) {
  await expectOwnersListedInOrder(this, await firstPageFromApi('sort=name,asc&size=10'));
});

Then('the first 10 owners by city are listed', async function (this: PlaywrightWorld) {
  await expectOwnersListedInOrder(this, await firstPageFromApi('sort=city,asc&size=10'));
});

Then('{int} owners are listed', async function (this: PlaywrightWorld, count: number) {
  await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(count);
});

Then('the paginator counts every owner in the clinic', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('#ownersTable mat-paginator'))
    .toContainText(`of ${this.requireOwnerCount()}`, {timeout: 10_000});
});
