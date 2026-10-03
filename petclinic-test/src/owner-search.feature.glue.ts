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
// table states the search term and the expected result set, and the expected
// pages are whatever the API answers for the same query.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

interface ListedOwner {
  id: number;
  name: string;
}

interface OwnerPage {
  content: {id: number; firstName: string; lastName: string}[];
  totalElements: number;
}

const SORT_KEYS: Record<string, string> = {Name: 'name', City: 'city'};
const DIRECTIONS: Record<string, string> = {ascending: 'asc', descending: 'desc'};

const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

async function fetchPage(params: Record<string, string | number>): Promise<OwnerPage> {
  const {data} = await axios.get<OwnerPage>(`${API_BASE}/owners`, {params, timeout: 10_000});
  return data;
}

/** Every owner, a page at a time, in the API's default order (Name ascending). */
async function fetchEveryOwner(): Promise<ListedOwner[]> {
  const owners: ListedOwner[] = [];
  for (let page = 0; ; page++) {
    const {content, totalElements} = await fetchPage({page, size: 20});
    owners.push(...content.map((o) => ({id: o.id, name: `${o.firstName} ${o.lastName}`})));
    if (content.length === 0 || owners.length >= totalElements) {
      return owners;
    }
  }
}

function rowLinks(world: PlaywrightWorld) {
  return world.page.locator('#ownersTable td.ownerFullName a');
}

async function listedIds(world: PlaywrightWorld): Promise<number[]> {
  const hrefs = await rowLinks(world).evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
  return hrefs.map((href) => Number(/owners\/(\d+)$/.exec(href)?.[1]));
}

function rangeLabel(world: PlaywrightWorld) {
  return world.page.locator('mat-paginator .mat-mdc-paginator-range-label');
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const listed = async () => (await rowLinks(world).allTextContents()).map((t) => t.trim()).filter(Boolean).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Waits for the click to land: for the rows themselves to change, never the range label —
 * the paginator moves that on the click, before the new page has even been requested.
 */
async function andWaitForAnotherPage(world: PlaywrightWorld, click: () => Promise<void>): Promise<void> {
  const before = await listedIds(world);
  await click();
  await expect.poll(() => listedIds(world), {timeout: 10_000}).not.toEqual(before);
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const everyOwner = await fetchEveryOwner();
  if (everyOwner.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(everyOwner.map((o) => o.name)).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwners = everyOwner;
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
  await andWaitForAnotherPage(this, () => this.page.getByRole('button', {name: 'Next page'}).click());
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await andWaitForAnotherPage(this, async () => {
    await this.page.locator('mat-paginator mat-select').click();
    await this.page.getByRole('option', {name: String(size), exact: true}).click();
  });
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await andWaitForAnotherPage(this, () => this.page.locator('#ownersTable th', {hasText: column}).click());
});

When('I page forward to the last page', async function (this: PlaywrightWorld) {
  const seen: number[] = [];
  const next = this.page.getByRole('button', {name: 'Next page'});
  await expect(rowLinks(this).first()).toBeVisible({timeout: 10_000});
  for (;;) {
    seen.push(...await listedIds(this));
    if (await next.isDisabled()) {
      break;
    }
    await andWaitForAnotherPage(this, () => next.click());
  }
  this.pagedOwnerIds = seen;
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners matching {string} by {word} {word} are listed, out of all that match',
  async function (this: PlaywrightWorld, size: number, lastName: string, column: string, direction: string) {
    const sort = `${SORT_KEYS[column]},${DIRECTIONS[direction]}`;
    const expected = await fetchPage({lastName, page: 0, size, sort});

    await expect.poll(() => listedIds(this), {timeout: 10_000}).toEqual(expected.content.map((o) => o.id));
    const range = `1 – ${expected.content.length} of ${expected.totalElements}`;
    await expect(rangeLabel(this)).toHaveText(range);
  });

Then('every owner in the clinic was listed exactly once, by Name ascending', async function (this: PlaywrightWorld) {
  expect(this.pagedOwnerIds).toEqual(this.requireAllOwners().map((o) => o.id));
});
