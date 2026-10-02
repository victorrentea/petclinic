import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {fetchAllOwners, OwnerPage} from './support/api-client';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set. Where an order is
// under test, the API is asked for the same page and is the oracle for it.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

const ownerCells = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');
const rangeLabel = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-range-label');

async function listedNames(world: PlaywrightWorld): Promise<string[]> {
  return (await ownerCells(world).allTextContents()).map((t) => t.trim()).filter(Boolean);
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNames(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table shows exactly `expected`, in this order. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedNames(world), {timeout: 10_000}).toEqual(expected);
}

/** Waits for the page starting at row `firstRow` to have answered — the label moves before the rows do. */
async function waitForPageFrom(world: PlaywrightWorld, firstRow: number): Promise<void> {
  await expect(rangeLabel(world)).toHaveText(new RegExp(`^\\s*${firstRow} –`), {timeout: 10_000});
  await expect(world.page.locator('#ownersTable')).toHaveAttribute('aria-busy', 'false', {timeout: 10_000});
}

async function apiPage(params: Record<string, string | number>): Promise<string[]> {
  const {data} = await axios.get<OwnerPage>(`${API_BASE}/owners`, {params, timeout: 10_000});
  return data.content.map(fullName);
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await fetchAllOwners(API_BASE);
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(all.map(fullName)).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwners = all;
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
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
  await waitForPageFrom(this, 1);
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await waitForPageFrom(this, 1);
  await this.page.getByRole('button', {name: 'Next page'}).click();
  await waitForPageFrom(this, 11);
});

When('I page through to the last page', async function (this: PlaywrightWorld) {
  const next = this.page.getByRole('button', {name: 'Next page'});
  const shown: number[] = [];
  for (let firstRow = 1; ; ) {
    await waitForPageFrom(this, firstRow);
    const hrefs = await ownerCells(this).locator('a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    shown.push(...hrefs.map((href) => Number(href!.split('/').pop())));
    if (await next.isDisabled()) {
      break;
    }
    firstRow = shown.length + 1;
    await next.click();
  }
  this.shownOwnerIds = shown;
});

When('I sort owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await this.page.locator('#ownersTable th', {hasText: column}).click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners by name are listed, out of every owner in the clinic',
  async function (this: PlaywrightWorld, count: number) {
    const all = this.requireAllOwners();
    await expectOwnersListedInOrder(this, all.slice(0, count).map(fullName));
    await expect(rangeLabel(this)).toHaveText(`1 – ${count} of ${all.length}`);
  });

Then('every owner in the clinic was shown exactly once, in name order', async function (this: PlaywrightWorld) {
  expect(this.requireAllOwners().length).toBeGreaterThan(20);
  expect(this.shownOwnerIds).toEqual(this.requireAllOwners().map((o) => o.id));
});

Then('the page lists the owners in {string} order', async function (this: PlaywrightWorld, sort: string) {
  await expectOwnersListedInOrder(this, await apiPage({sort, size: 10}));
});

Then('the page lists the {string} owners in {string} order',
  async function (this: PlaywrightWorld, lastName: string, sort: string) {
    await expectOwnersListedInOrder(this, await apiPage({lastName, sort, size: 10}));
  });

Then('the grid shows owners {string} of every owner in the clinic',
  async function (this: PlaywrightWorld, range: string) {
    await expect(rangeLabel(this)).toHaveText(`${range} of ${this.requireAllOwners().length}`);
  });

Then('the grid shows owners {string} of {int}', async function (this: PlaywrightWorld, range: string, total: number) {
  await expect(rangeLabel(this)).toHaveText(`${range} of ${total}`);
});
