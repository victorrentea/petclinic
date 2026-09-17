import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {fetchAllOwners} from './support/owners-api';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// The grid renders the Name column as "LastName, FirstName" (design decision #6),
// so every comparison against the grid's cell text uses that same order. The
// Examples table separates several owners with ";" — not "," — since a comma is
// now also part of a single owner's own display name.
const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const displayName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

const DEFAULT_PAGE_SIZE = 10;

const ownerCells = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');
const nextPageButton = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-navigation-next');
const pageSizeSelect = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-page-size-select');

const currentlyListedOwners = async (world: PlaywrightWorld): Promise<string[]> =>
  (await ownerCells(world).allTextContents()).map((t) => t.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const listed = async () => (await currentlyListedOwners(world)).sort();
  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Waits for a genuinely new page to render: `pageIndex`/paginator state updates
 * synchronously on click, well before the follow-up HTTP request resolves, so
 * polling on anything paginator-side (e.g. its range label) can observe the old
 * rows under the new label. Comparing the actually-rendered rows against the
 * previous page's own rows is what proves the fetch has actually landed.
 */
async function waitForOwnersPage(world: PlaywrightWorld, expectedCount: number, disjointFrom: string[]): Promise<string[]> {
  await expect.poll(async () => {
    const current = await currentlyListedOwners(world);
    return current.length === expectedCount && current.every((name) => !disjointFrom.includes(name));
  }, {timeout: 10_000}).toBe(true);
  return currentlyListedOwners(world);
}

/** Walks every page of the grid (at the default page size), collecting the owners shown along the way. */
async function collectOwnersAcrossAllPages(world: PlaywrightWorld, total: number): Promise<string[]> {
  const collected: string[] = [];
  let previousPage: string[] = [];
  let remaining = total;
  while (remaining > 0) {
    const expectedCount = Math.min(DEFAULT_PAGE_SIZE, remaining);
    const current = await waitForOwnersPage(world, expectedCount, previousPage);
    collected.push(...current);
    previousPage = current;
    remaining -= expectedCount;
    if (remaining > 0) {
      await nextPageButton(world).click();
    }
  }
  return collected;
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const allOwners = await fetchAllOwners(API_BASE);
  if (allOwners.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  const names = allOwners.map(fullName);
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = allOwners.map(displayName);
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

Then('every owner in the clinic is listed, paging through the grid as needed', async function (this: PlaywrightWorld) {
  const expected = this.requireAllOwnerNames();
  const listed = await collectOwnersAcrossAllPages(this, expected.length);
  expect(listed.sort()).toEqual([...expected].sort());
});

Then('the first page shows {int} owners', async function (this: PlaywrightWorld, count: number) {
  await waitForOwnersPage(this, count, []);
});

When('I go to the next page of owners', async function (this: PlaywrightWorld) {
  this.previousPageOwnerNames = await currentlyListedOwners(this);
  await nextPageButton(this).click();
});

Then('a different page of {int} owners is shown', async function (this: PlaywrightWorld, count: number) {
  await waitForOwnersPage(this, count, this.previousPageOwnerNames ?? []);
});

When('I set the page size to {int}', async function (this: PlaywrightWorld, size: number) {
  await pageSizeSelect(this).click();
  await this.page.getByRole('option', {name: String(size)}).click();
});
