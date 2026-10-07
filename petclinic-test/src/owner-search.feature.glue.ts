import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ApiClient} from './support/api-client';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const api = new ApiClient();

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

const listedNames = async (world: PlaywrightWorld) =>
  (await world.page.locator('#ownersTable td.ownerFullName').allTextContents()).map((t) => t.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNames(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table shows exactly `expected`, in that order. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedNames(world), {timeout: 10_000}).toEqual(expected);
}

/** The full names the API lists first for this query — what the grid must show, in that order. */
async function firstPageFromApi(query: string): Promise<string[]> {
  return (await api.fetchOwnersPage(query)).content.map(fullName);
}

/**
 * Checks that the owners the Background names exist, and remembers how many owners the
 * clinic holds — so a changed seed (Flyway's db/seed/R__seed.sql) fails on the Given
 * instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const names = owners.raw().map(([name]) => name.trim());
  const lastNames = [...new Set(names.map((name) => name.split(' ').pop()))];
  const [all, ...matches] = await Promise.all([
    api.fetchOwnersPage('size=1'),
    ...lastNames.map((lastName) => api.fetchOwnersPage(`lastName=${lastName}&size=100`)),
  ]);
  const found = matches.flatMap((page) => page.content.map(fullName));
  expect(found, 'is the backend up and the DB seeded by Flyway?').toEqual(expect.arrayContaining(names));
  this.ownerCount = all.totalElements;
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
  await this.page.locator(`#ownersTable th:has-text("${column}") button`).click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first 10 owners by {word} are listed', async function (this: PlaywrightWorld, sortKey: string) {
  await expectOwnersListedInOrder(this, await firstPageFromApi(`sort=${sortKey},asc&size=10`));
});

Then('{int} owners are listed', async function (this: PlaywrightWorld, count: number) {
  await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(count);
});

Then('the paginator counts every owner in the clinic', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('#ownersTable mat-paginator'))
    .toContainText(`of ${this.requireOwnerCount()}`, {timeout: 10_000});
});
