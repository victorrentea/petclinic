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
// table states the search term and the expected result set. Expected orders come
// from the API, read a page at a time: other specs leave owners behind, so the
// clinic's owners are whatever the database holds when the scenario starts.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const API_PAGE_SIZE = 20;

type ApiOwner = {firstName: string; lastName: string};
const fullName = (o: ApiOwner) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);
const sortOf = (key: string, direction: string) => `${key},${direction === 'descending' ? 'desc' : 'asc'}`;

/** Every owner, in the given order, read through the API one page at a time. */
async function ownerNamesFromApi(sort: string): Promise<string[]> {
  const names: string[] = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${API_BASE}/owners`,
      {params: {page, size: API_PAGE_SIZE, sort}, timeout: 10_000});
    names.push(...data.content.map(fullName));
    if (data.content.length < API_PAGE_SIZE || names.length >= data.totalElements) {
      return names;
    }
  }
}

const ownerCells = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');
const listedNow = async (world: PlaywrightWorld) =>
  (await ownerCells(world).allTextContents()).map((t) => t.trim()).filter(Boolean);
const rangeLabel = (world: PlaywrightWorld) =>
  world.page.locator('.mat-mdc-paginator-range-label').innerText().then((t) => t.trim());

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNow(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedNow(world), {timeout: 10_000}).toEqual(expected);
}

/** The paginator moves at once; the rows only once the request it sent has answered. */
async function waitForThePageToLoad(world: PlaywrightWorld): Promise<void> {
  await world.page.locator('#ownersTable[aria-busy="false"]').waitFor({timeout: 10_000});
}

async function goToTheNextPage(world: PlaywrightWorld): Promise<void> {
  const before = await rangeLabel(world);
  await world.page.locator('.mat-mdc-paginator-navigation-next').click();
  await expect.poll(() => rangeLabel(world)).not.toBe(before);
  await waitForThePageToLoad(world);
}

/**
 * Remembers every owner the clinic holds, in name order, after checking that the ones
 * the Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const names = await ownerNamesFromApi('name,asc');
  if (names.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = names;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await waitForThePageToLoad(this);
  await goToTheNextPage(this);
});

When('I choose {int} rows per page', async function (this: PlaywrightWorld, size: number) {
  await waitForThePageToLoad(this);
  await this.page.locator('.mat-mdc-paginator-page-size-select').click();
  await this.page.locator('mat-option', {hasText: String(size)}).click();
  await expect.poll(() => rangeLabel(this)).toMatch(new RegExp(`^1 – ${size} of`));
  await waitForThePageToLoad(this);
});

When('I page through to the last page', async function (this: PlaywrightWorld) {
  await waitForThePageToLoad(this);
  const listed = await listedNow(this);
  const next = this.page.locator('.mat-mdc-paginator-navigation-next');
  while (await next.isEnabled()) {
    await goToTheNextPage(this);
    listed.push(...await listedNow(this));
  }
  this.listedOwnerNames = listed;
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await waitForThePageToLoad(this);
  await this.page.locator('#ownersTable th[mat-sort-header]', {hasText: column}).click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners by {word} {word} are listed in order',
  async function (this: PlaywrightWorld, count: number, key: string, direction: string) {
    const expected = key === 'name' && direction === 'ascending'
      ? this.requireAllOwnerNames()
      : await ownerNamesFromApi(sortOf(key, direction));
    await expectOwnersListedInOrder(this, expected.slice(0, count));
  });

Then('the paginator shows {string} of every owner in the clinic',
  async function (this: PlaywrightWorld, range: string) {
    await expect.poll(() => rangeLabel(this)).toBe(`${range} of ${this.requireAllOwnerNames().length}`);
  });

Then('the paginator shows {string}', async function (this: PlaywrightWorld, label: string) {
  await expect.poll(() => rangeLabel(this)).toBe(label);
});

Then('every owner in the clinic was listed once, in name order', async function (this: PlaywrightWorld) {
  expect(this.listedOwnerNames).toEqual(this.requireAllOwnerNames());
});
