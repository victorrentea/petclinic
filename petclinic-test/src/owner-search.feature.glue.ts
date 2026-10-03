import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect, Locator, Response} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {fetchAllOwners} from './support/owners-api';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set. Expected orders come
// from the API, never from a hard-coded list, because the database's collation —
// not this file — decides where "Śliwiński" sorts.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

function ownerCells(world: PlaywrightWorld): Locator {
  return world.page.locator('#ownersTable td.ownerFullName');
}

async function listedNames(world: PlaywrightWorld): Promise<string[]> {
  return (await ownerCells(world).allTextContents()).map((t) => t.trim()).filter(Boolean);
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNames(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table has settled on exactly `expected`, in that order. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedNames(world), {timeout: 10_000}).toEqual(expected);
}

function rangeLabel(world: PlaywrightWorld): Locator {
  return world.page.locator('mat-paginator .mat-mdc-paginator-range-label');
}

function ownersPageResponse(world: PlaywrightWorld): Promise<Response> {
  return world.page.waitForResponse((r) => /\/api\/owners(\?|$)/.test(r.url()) && r.request().method() === 'GET');
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await fetchAllOwners();
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  const names = all.map(fullName);
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

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  const loaded = ownersPageResponse(this);
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
  await loaded;
});

When('I go to the next page of owners', async function (this: PlaywrightWorld) {
  await expect(rangeLabel(this)).toContainText('1 –');
  const loaded = ownersPageResponse(this);
  await this.page.getByRole('button', {name: 'Next page'}).click();
  await loaded;
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  const loaded = ownersPageResponse(this);
  await this.page.locator('#ownersTable th', {hasText: column}).click();
  await loaded;
});

When('I page through to the last page', async function (this: PlaywrightWorld) {
  const next = this.page.getByRole('button', {name: 'Next page'});
  const collected: string[] = [];
  await expect(ownerCells(this).first()).toBeVisible();
  for (;;) {
    collected.push(...await listedNames(this));
    if (await next.isDisabled()) {
      break;
    }
    const loaded = ownersPageResponse(this);
    await next.click();
    const {content} = await (await loaded).json();
    await expectOwnersListedInOrder(this, content.map(fullName));
  }
  this.traversedOwnerNames = collected;
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

Then('every owner in the clinic was listed once, in name order', async function (this: PlaywrightWorld) {
  expect(this.traversedOwnerNames).toEqual(this.requireAllOwnerNames());
});

Then('the first 10 owners by {string} are listed', async function (this: PlaywrightWorld, sort: string) {
  const {data} = await axios.get(`${API_BASE}/owners`, {params: {sort}, timeout: 10_000});
  await expectOwnersListedInOrder(this, data.content.map(fullName));
});

Then('the owners shown are 1 to {int} of every owner in the clinic',
  async function (this: PlaywrightWorld, end: number) {
    await expect(rangeLabel(this)).toHaveText(`1 – ${end} of ${this.requireAllOwnerNames().length}`);
  });

Then('the owners shown are 1 to {int} of {int}', async function (this: PlaywrightWorld, end: number, total: number) {
  await expect(rangeLabel(this)).toHaveText(`1 – ${end} of ${total}`);
});
