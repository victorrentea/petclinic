import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {ApiClient, OwnerDto, OwnerPage} from './support/api-client';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set. Expected orderings come
// from the API itself, so the database's collation decides them in both places.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';


const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

async function ownerPage(params: {page?: number; size?: number; sort?: string}): Promise<OwnerPage> {
  const {data} = await axios.get<OwnerPage>(`${API_BASE}/owners`, {params, timeout: 10_000});
  return data;
}

/** Every owner, page after page, failing on an owner seen twice or one never reached. */
async function everyOwnerByName(): Promise<OwnerDto[]> {
  const owners: OwnerDto[] = [];
  let total = 0;
  for await (const {content, totalElements} of new ApiClient(API_BASE).ownerPages('name,asc')) {
    owners.push(...content);
    total = totalElements;
  }
  expect(new Set(owners.map((o) => o.id)).size, 'distinct owner ids across pages').toBe(owners.length);
  expect(owners.length, 'owners reached by paging').toBe(total);
  return owners;
}

const listedNames = async (world: PlaywrightWorld) =>
  (await world.page.locator('#ownersTable td.ownerFullName').allTextContents()).map((t) => t.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNames(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Runs a UI action that loads a page of owners, and returns once that page is on screen.
 * The table is aria-busy from the click until its response is rendered, in the same change
 * detection that draws the rows, so "not busy after the response" means "rows are current".
 */
async function loadingOwners(world: PlaywrightWorld, action: () => Promise<unknown>): Promise<void> {
  const response = world.page.waitForResponse((r) =>
    new URL(r.url()).pathname.endsWith('/api/owners') && r.request().method() === 'GET');
  await action();
  await response;
  await expect(world.page.locator('#ownersTable[aria-busy="false"], #noOwners, #ownersError').first())
    .toBeVisible({timeout: 10_000});
}

const rangeLabel = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-range-label');
const nextPage = (world: PlaywrightWorld) => world.page.locator('button.mat-mdc-paginator-navigation-next');

/**
 * Remembers every owner the clinic holds, by name, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await everyOwnerByName();
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  const names = all.map(fullName);
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = names;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await loadingOwners(this, () => this.page.goto('/owners'));
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await loadingOwners(this, () => this.page.locator('#search-owner-form button[type="submit"]').click());
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await loadingOwners(this, () => this.page.getByRole('option', {name: String(size), exact: true}).click());
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await loadingOwners(this, () => nextPage(this).click());
});

When('I page forward to the last page', async function (this: PlaywrightWorld) {
  const listed = await listedNames(this);
  while (await nextPage(this).isEnabled()) {
    await loadingOwners(this, () => nextPage(this).click());
    listed.push(...await listedNames(this));
  }
  this.listedAcrossPages = listed;
});

When('I sort owners by {string} {string}', async function (this: PlaywrightWorld, column: string, direction: string) {
  const header = this.page.locator(`#ownersTable th[mat-sort-header]:has-text("${column}")`);
  for (let clicks = 0; (await header.getAttribute('aria-sort')) !== direction; clicks++) {
    expect(clicks, `clicks on ${column} to sort ${direction}`).toBeLessThan(2);
    await loadingOwners(this, () => header.click());
  }
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('these owners are listed in order: {string}', async function (this: PlaywrightWorld, owners: string) {
  expect(await listedNames(this)).toEqual(namesIn(owners));
});

Then('the first {int} owners by {string} are listed in order', async function (
  this: PlaywrightWorld, size: number, sort: string) {
  const {content} = await ownerPage({page: 0, size, sort});
  expect(await listedNames(this)).toEqual(content.map(fullName));
});

Then('every owner was listed exactly once, by name', async function (this: PlaywrightWorld) {
  expect(this.listedAcrossPages).toEqual(this.requireAllOwnerNames());
});

Then('the range reads {string} of every owner', async function (this: PlaywrightWorld, range: string) {
  await expect(rangeLabel(this)).toHaveText(`${range} of ${this.requireAllOwnerNames().length}`);
});

Then('the range reads {string}', async function (this: PlaywrightWorld, range: string) {
  await expect(rangeLabel(this)).toHaveText(range);
});
