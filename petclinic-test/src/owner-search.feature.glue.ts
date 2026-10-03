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
// table states the search term and the expected result set. Where order is under
// test, the expected order is the API's own, read page by page.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

interface ApiOwner {id: number; firstName: string; lastName: string}

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

/** Every owner, in the API's order for `sort`: page by page, failing on a gap or a repeat. */
async function allOwnersInOrder(sort: string): Promise<ApiOwner[]> {
  const owners: ApiOwner[] = [];
  let total = Infinity;
  for (let page = 0; owners.length < total; page++) {
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {page, size: 20, sort}, timeout: 10_000});
    if (!Array.isArray(data?.content) || typeof data.totalElements !== 'number') {
      throw new Error('The API did not answer with a page of owners — is the backend up to date?');
    }
    if (data.content.length === 0) {
      break;
    }
    owners.push(...data.content);
    total = data.totalElements;
  }
  const ids = owners.map((o) => o.id);
  expect(new Set(ids).size, 'an owner appeared on two pages').toBe(ids.length);
  expect(ids.length, 'paging missed owners').toBe(total);
  return owners;
}

function listedNames(world: PlaywrightWorld): Promise<string[]> {
  return world.page.locator('#ownersTable td.ownerFullName').allTextContents()
    .then((texts) => texts.map((t) => t.trim()).filter(Boolean));
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNames(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table shows exactly `expected`, in that order. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedNames(world), {timeout: 10_000}).toEqual(expected);
}

function rangeLabel(world: PlaywrightWorld) {
  return world.page.locator('.mat-mdc-paginator-range-label');
}

/**
 * Remembers every owner the clinic holds, in name order, after checking that the ones
 * the Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const names = (await allOwnersInOrder('name,asc')).map(fullName);
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

/** Runs a UI action and waits for the one owner-list response it triggers. */
async function awaitingOwnerList(world: PlaywrightWorld, action: () => Promise<void>): Promise<void> {
  const listed = world.page.waitForResponse((r) => /\/api\/owners\?/.test(r.url()) && r.ok(), {timeout: 10_000});
  await action();
  await listed;
}

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await awaitingOwnerList(this, () => this.page.getByRole('option', {name: String(size), exact: true}).click());
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await awaitingOwnerList(this, () => this.page.getByRole('button', {name: 'Next page'}).click());
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await awaitingOwnerList(this, () => this.page.locator('#ownersTable th', {hasText: column}).click());
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first 10 owners by name are listed, out of every owner in the clinic',
  async function (this: PlaywrightWorld) {
    const all = this.requireAllOwnerNames();
    await expectOwnersListedInOrder(this, all.slice(0, 10));
    await expect(rangeLabel(this)).toHaveText(`1 – 10 of ${all.length}`);
  });

Then('paging to the end lists every owner in the clinic once, by name', async function (this: PlaywrightWorld) {
  const all = this.requireAllOwnerNames();
  const seen: string[] = [];
  for (let first = 0; first < all.length; first += 5) {
    const expectedPage = all.slice(first, first + 5);
    await expectOwnersListedInOrder(this, expectedPage);
    seen.push(...expectedPage);
    if (first + 5 < all.length) {
      await this.page.getByRole('button', {name: 'Next page'}).click();
    }
  }
  expect(seen).toEqual(all);
  await expect(this.page.getByRole('button', {name: 'Next page'})).toBeDisabled();
});

Then('the first page lists the owners by {string}', async function (this: PlaywrightWorld, sort: string) {
  const expected = (await allOwnersInOrder(sort)).slice(0, 10).map(fullName);
  await expectOwnersListedInOrder(this, expected);
});

Then('the page range starts at owner 1', async function (this: PlaywrightWorld) {
  await expect(rangeLabel(this)).toHaveText(/^\s*1 – /);
});

Then('the page range reads {string}', async function (this: PlaywrightWorld, range: string) {
  await expect(rangeLabel(this)).toHaveText(range);
});
