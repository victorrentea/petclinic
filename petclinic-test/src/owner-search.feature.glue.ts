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

/** Every owner the clinic holds, walking the API's pages of 20. */
async function everyOwnerName(): Promise<{names: string[]; firstPage: string[]}> {
  const names: string[] = [];
  let firstPage: string[] = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {page, size: 20}, timeout: 10_000});
    names.push(...data.content.map(fullName));
    if (page === 0) {
      const {data: defaultPage} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
      firstPage = defaultPage.content.map(fullName);
    }
    if (page + 1 >= data.totalPages) return {names, firstPage};
  }
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql, which the feature asks for with @fixture:default) fails on
 * the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const {names, firstPage} = await everyOwnerName();
  if (names.length === 0) {
    throw new Error('The API returned no owners — is the backend up, and was the DB reset to ' +
      'the @fixture:default this feature declares?');
  }
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = names;
  this.firstPageOwnerNames = firstPage;
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

// The grid shows one page (#25): every owner is counted, the first page is listed.
Then('every owner in the clinic is listed', async function (this: PlaywrightWorld) {
  const total = this.requireAllOwnerNames().length;
  await expect(this.page.locator('.mat-mdc-paginator-range-label, .mat-paginator-range-label'))
    .toContainText(`of ${total}`);
  await expectOwnersListed(this, this.firstPageOwnerNames ?? []);
});
