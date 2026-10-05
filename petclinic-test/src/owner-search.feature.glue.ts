import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ApiClient, ownerName} from './support/api-client';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const api = new ApiClient();
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected`, in that order: the grid sorts by name. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);

  await expect.poll(listed, {timeout: 10_000}).toEqual(expected);
}

/**
 * Remembers the first page of owners and how many the clinic holds, after checking
 * that the ones the Background names exist — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const names = owners.raw().map(([name]) => name.trim());
  const lastNames = [...new Set(names.map((name) => name.split(',')[0]))];
  const [firstPage, ...matching] = await Promise.all([
    api.fetchOwnersPage(),
    ...lastNames.map((lastName) => api.fetchOwnersPage({lastName, size: 20})),
  ]);
  if (!firstPage.totalElements) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(matching.flatMap((page) => page.content.map(ownerName))).toEqual(expect.arrayContaining(names));
  this.firstPage = {names: firstPage.content.map(ownerName), count: firstPage.totalElements};
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first page of every owner in the clinic is listed', async function (this: PlaywrightWorld) {
  const {names, count} = this.requireFirstPage();
  await expectOwnersListed(this, names);
  await expect(this.page.locator('.mat-mdc-paginator-range-label')).toHaveText(`1 – ${names.length} of ${count}`);
});
