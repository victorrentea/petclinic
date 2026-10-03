import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect, Locator} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set. Expected orders come
// from the API, not from JavaScript: the database collation decides where Śliwiński sorts.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

interface OwnerRow {id: number; firstName: string; lastName: string}
interface OwnerPage {content: OwnerRow[]; totalElements: number}

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

/** Every owner the API holds, page after page in `sort` order — failing on an owner repeated or skipped. */
async function allOwners(sort: string): Promise<OwnerRow[]> {
  const owners: OwnerRow[] = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get<OwnerPage>(`${API_BASE}/owners`,
      {params: {page, size: 20, sort}, timeout: 10_000});
    owners.push(...data.content);
    if (data.content.length === 0 || owners.length >= data.totalElements) {
      expect(new Set(owners.map((o) => o.id)).size, 'an owner repeated across pages').toBe(owners.length);
      expect(owners.length, 'owners skipped across pages').toBe(data.totalElements);
      return owners;
    }
  }
}

const ownerCells = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');
const listedNames = async (world: PlaywrightWorld) =>
  (await ownerCells(world).allTextContents()).map((t) => t.trim()).filter(Boolean);
const rangeLabel = (world: PlaywrightWorld): Locator => world.page.locator('.mat-mdc-paginator-range-label');

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNames(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table has settled on exactly `expected`, in that order. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedNames(world), {timeout: 10_000}).toEqual(expected);
}

/**
 * Remembers every owner the clinic holds, in name order, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's db/seed/R__seed.sql) fails
 * on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const names = (await allOwners('name,asc')).map(fullName);
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
  await rangeLabel(this).waitFor({state: 'visible', timeout: 10_000});
  await this.page.locator('.mat-mdc-paginator-navigation-next').click();
  await expect(rangeLabel(this)).not.toHaveText(/^1 – /);
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

// Waits for the list request the click sends, not for the rows to change: a row change can come from elsewhere,
// and a second click sent before the first answer lands would race it.
When('I sort owners by {string}', async function (this: PlaywrightWorld, column: string) {
  const answered = this.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/api/owners'));
  await this.page.locator('#ownersTable th[mat-sort-header]', {hasText: column}).click();
  await answered;
});

When('I page through every owner, {int} at a time', async function (this: PlaywrightWorld, size: number) {
  const all = this.requireAllOwnerNames();
  const listed: string[] = [];
  for (let start = 0; start < all.length; start += size) {
    if (start > 0) {
      await this.page.locator('.mat-mdc-paginator-navigation-next').click();
    }
    const end = Math.min(start + size, all.length);
    await expect(rangeLabel(this)).toHaveText(`${start + 1} – ${end} of ${all.length}`);
    await expectOwnersListedInOrder(this, all.slice(start, end));
    listed.push(...await listedNames(this));
  }
  this.listedOwnerNames = listed;
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners by name are listed', async function (this: PlaywrightWorld, count: number) {
  await expectOwnersListedInOrder(this, this.requireAllOwnerNames().slice(0, count));
});

Then('the first {int} owners by city descending are listed', async function (this: PlaywrightWorld, count: number) {
  const byCityDescending = (await allOwners('city,desc')).map(fullName);
  await expectOwnersListedInOrder(this, byCityDescending.slice(0, count));
});

Then('the range shows owners {int} to {int} of every owner',
  async function (this: PlaywrightWorld, from: number, to: number) {
    await expect(rangeLabel(this)).toHaveText(`${from} – ${to} of ${this.requireAllOwnerNames().length}`);
  });

Then('the range shows owners {int} to {int} of {int}',
  async function (this: PlaywrightWorld, from: number, to: number, total: number) {
    await expect(rangeLabel(this)).toHaveText(`${from} – ${to} of ${total}`);
  });

Then('every owner was listed exactly once, in name order', async function (this: PlaywrightWorld) {
  expect(this.listedOwnerNames).toEqual(this.requireAllOwnerNames());
});
