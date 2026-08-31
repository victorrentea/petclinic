import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {fetchAllOwners, OwnerRow} from './support/owners-api';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

/**
 * The grid renders an owner family name first, so the Name column reads in the order
 * it is sorted by. Every expectation in the .feature is written the same way.
 */
const fullName = (o: Pick<OwnerRow, 'firstName' | 'lastName'>) => `${o.lastName}, ${o.firstName}`;

/**
 * The names in an expectation cell, separated by `;`.
 *
 * Not `,`: a rendered name now *contains* a comma ("Potter, Harry"), so splitting on
 * one would quietly turn a two-owner expectation into four half-names and pass or fail
 * for the wrong reason.
 */
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

const paginator = (world: PlaywrightWorld) => world.page.locator('[data-test="owners-paginator"]');

/** The data-test id of each sortable header — the grid sorts by these two columns only. */
const SORTABLE_HEADERS: Record<string, string> = {Name: 'sort-name', City: 'sort-city'};

/** The Name cells of the grid, top to bottom, as the reader sees them. */
async function listedOwners(world: PlaywrightWorld): Promise<string[]> {
  const cells = await world.page.locator('#ownersTable td.ownerFullName').allTextContents();
  return cells.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedOwners(world)).sort(), {timeout: 10_000})
      .toEqual([...expected].sort());
}

/** Same, but the row order *is* the assertion — what the paging and sorting scenarios are about. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(() => listedOwners(world), {timeout: 10_000}).toEqual(expected);
}

async function expectPaginatorTotal(world: PlaywrightWorld, total: number): Promise<void> {
  // Material's range label — "1 – 10 of 28". Matched on a word boundary so "of 2"
  // cannot pass against a paginator reporting 28.
  await expect.poll(async () => (await paginator(world).innerText()).replace(/\s+/g, ' '), {timeout: 10_000})
      .toMatch(new RegExp(`of ${total}\\b`));
}

async function waitForTheGrid(world: PlaywrightWorld): Promise<void> {
  await world.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
  // Wait for the first server page to have landed, so a step that clicks the paginator
  // next isn't racing the request that fills it.
  await world.page.locator('#ownersTable td.ownerFullName').first().waitFor({state: 'visible', timeout: 10_000});
}

/**
 * Counts the clinic's owners — page by page, since the listing endpoint hands out one
 * page at a time — after checking that the ones the Background names are among them, so
 * a changed seed (Flyway's V3__sample_data.sql) fails on the Given instead of looking
 * like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const {owners: all, total} = await fetchAllOwners();
  const names = all.map(fullName);
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  expect(names).toHaveLength(total);
  this.ownerTotal = total;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await waitForTheGrid(this);
});

/** Deep-links straight into a grid view — `page=1&size=20&sort=city,asc` — instead of clicking there. */
When('I open the owners page at {string}', async function (this: PlaywrightWorld, query: string) {
  await this.page.goto(`/owners?${query}`);
  await waitForTheGrid(this);
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
});

When('I choose a page size of {int}', async function (this: PlaywrightWorld, size: number) {
  await paginator(this).locator('mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await paginator(this).getByRole('button', {name: 'Next page'}).click();
});

When('I sort by {string}', async function (this: PlaywrightWorld, column: string) {
  const header = SORTABLE_HEADERS[column];
  if (!header) {
    throw new Error(`The grid has no sortable "${column}" header; it sorts by `
        + `${Object.keys(SORTABLE_HEADERS).join(' and ')} only`);
  }
  await this.page.locator(`[data-test="${header}"]`).click();
});

When('I note the owners listed on this page', async function (this: PlaywrightWorld) {
  const listed = await listedOwners(this);
  expect(listed.length).toBeGreaterThan(0);
  this.notedOwnerNames = listed;
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  const expected = namesIn(owners);
  await expectOwnersListed(this, expected);
  // The table itself is always in the DOM, so an empty result is only visible as the
  // "no owners" message — assert it rather than the absence of rows alone.
  if (expected.length === 0) {
    await expect(this.page.locator('#noOwners')).toBeVisible({timeout: 10_000});
  }
});

Then('these owners are listed in order:', async function (this: PlaywrightWorld, owners: DataTable) {
  await expectOwnersListedInOrder(this, owners.raw().map(([name]) => name.trim()));
});

Then('the grid lists {int} owners', async function (this: PlaywrightWorld, count: number) {
  await expect.poll(async () => (await listedOwners(this)).length, {timeout: 10_000}).toBe(count);
});

Then('none of the owners I noted are listed', async function (this: PlaywrightWorld) {
  const noted = this.requireNotedOwnerNames();
  const listed = await listedOwners(this);
  expect(listed.filter((name) => noted.includes(name))).toEqual([]);
});

Then('the paginator reports the total number of owners in the clinic', async function (this: PlaywrightWorld) {
  await expectPaginatorTotal(this, this.requireOwnerTotal());
});

Then('the paginator reports {int} owners in total', async function (this: PlaywrightWorld, total: number) {
  await expectPaginatorTotal(this, total);
});

Then('the URL carries {string}', async function (this: PlaywrightWorld, fragment: string) {
  await expect.poll(() => decodeURIComponent(this.page.url()), {timeout: 10_000}).toContain(fragment);
});
