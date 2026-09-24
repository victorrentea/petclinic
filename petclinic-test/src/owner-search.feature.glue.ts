import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ApiClient, OwnerRowDto} from './support/api-client';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set. Owners are named the
// way the grid names them, "Potter, Harry" — hence `;` between names in a cell.

// Every selector the owners grid is driven through, and nowhere else.
const GRID = {
  names: '#ownersTable td.ownerFullName',
  lastName: '#lastName',
  search: '#search-owner-form button[type="submit"]',
  // An <app-combo>: its `inputId` lands on the <select> inside it, an `id` on the host.
  pageSize: 'select#pageSize, #pageSize select',
  nextPage: '#nextPage',
  pageInfo: '#pageInfo',
  // While a page loads the table holds placeholder rows and says so.
  settledTable: '#ownersTable[aria-busy="false"]',
  sortButton: (column: string) => `th button.sort-${column.toLowerCase()}`,
  // ARIA allows aria-sort only on the column header, so it sits on the <th>, not the button.
  sortHeader: (column: string) => `th.col-${column.toLowerCase()}`,
};
const PAGE_INFO = /Page\s+(\d+)\s+of\s+(\d+)/;

const gridName = (o: OwnerRowDto) => `${o.lastName}, ${o.firstName}`;
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

/** The names in the grid right now, top to bottom. */
async function listedNames(world: PlaywrightWorld): Promise<string[]> {
  return (await world.page.locator(GRID.names).allTextContents()).map((t) => t.trim()).filter(Boolean);
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const listedSorted = async () => (await listedNames(world)).sort();
  await expect.poll(listedSorted, {timeout: 10_000}).toEqual([...expected].sort());
}

/** Reads "Page X of Y" once the grid shows one. */
async function shownPage(world: PlaywrightWorld): Promise<{page: number; of: number}> {
  const pageInfo = world.page.locator(GRID.pageInfo);
  await expect(pageInfo).toHaveText(PAGE_INFO, {timeout: 10_000});
  const [, page, of] = PAGE_INFO.exec((await pageInfo.textContent()) ?? '')!;
  return {page: Number(page), of: Number(of)};
}

/**
 * Clicks next and waits for the next page's rows: reading the grid before they land
 * would count the previous page twice.
 */
async function goToNextPage(world: PlaywrightWorld): Promise<void> {
  const {page} = await shownPage(world);
  const namesBefore = await listedNames(world);
  await world.page.locator(GRID.nextPage).click();
  await expect(world.page.locator(GRID.pageInfo)).toContainText(`Page ${page + 1} of `);
  await world.page.locator(GRID.settledTable).waitFor({timeout: 10_000});
  await expect.poll(() => listedNames(world), {timeout: 10_000}).not.toEqual(namesBefore);
}

/**
 * Remembers every owner the clinic holds — walking the API page by page, as nothing
 * returns them all at once — after checking that the ones the Background names are
 * among them, so a changed seed (Flyway's db/seed/R__seed.sql) fails on the Given
 * instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await new ApiClient().fetchAllOwners();
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  const names = all.map(gridName);
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = names;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
  await this.page.locator(GRID.names).first().waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator(GRID.lastName).fill(search);
  await this.page.locator(GRID.search).click();
});

// The combo's labels are the design system's to word ("5", "5 per page"…); the number leads.
When('I choose {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  const combo = this.page.locator(GRID.pageSize);
  const labels = (await combo.locator('option').allTextContents()).map((l) => l.trim());
  const index = labels.findIndex((l) => new RegExp(`^${size}\\b`).test(l));
  if (index < 0) {
    throw new Error(`No page size ${size} offered; the combo has: ${labels.join(' | ')}`);
  }
  await combo.selectOption({index});
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await goToNextPage(this);
});

// Which way the first click on an inactive column sorts is the grid's call; clicking the
// active column toggles, so at most two clicks reach descending.
When('I sort owners by {string} descending', async function (this: PlaywrightWorld, column: string) {
  const header = this.page.locator(GRID.sortHeader(column));
  const button = this.page.locator(GRID.sortButton(column));
  for (let clicks = 0; clicks < 2 && (await header.getAttribute('aria-sort')) !== 'descending'; clicks++) {
    const before = await header.getAttribute('aria-sort');
    await button.click();
    await expect.poll(() => header.getAttribute('aria-sort')).not.toBe(before);
  }
  await expect(header).toHaveAttribute('aria-sort', 'descending');
});

When('I page through every page of owners', async function (this: PlaywrightWorld) {
  const {of: pageCount} = await shownPage(this);
  const listed = await listedNames(this);
  for (let page = 2; page <= pageCount; page++) {
    await goToNextPage(this);
    listed.push(...await listedNames(this));
  }
  await expect(this.page.locator(GRID.nextPage)).toBeDisabled();
  this.listedOwnerNames = listed;
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('{int} owners are listed', async function (this: PlaywrightWorld, count: number) {
  await expect(this.page.locator(GRID.names)).toHaveCount(count, {timeout: 10_000});
});

Then('page {int} is shown', async function (this: PlaywrightWorld, page: number) {
  await expect(this.page.locator(GRID.pageInfo)).toContainText(`Page ${page} of `, {timeout: 10_000});
});

// Compared as multisets: a name listed twice, or missing, both fail — two owners who
// really share a name would still pass.
Then('every owner in the clinic was listed exactly once', async function (this: PlaywrightWorld) {
  if (!this.listedOwnerNames) {
    throw new Error('Expected the grid to have been paged through earlier in the scenario');
  }
  expect([...this.listedOwnerNames].sort()).toEqual([...this.requireAllOwnerNames()].sort());
});

// What "descending" means for "Ile-de-France" vs "Inverness" is the database collation's
// call (en_US in dev, C in CI), and the backend's MockMvc tests pin it. Here: the grid
// asked for city/desc and shows that page exactly as the API serves it.
Then('the owners are listed in descending city order', async function (this: PlaywrightWorld) {
  await expect(this.page).toHaveURL(/[?&]sort=city(&|$)/);
  await expect(this.page).toHaveURL(/[?&]direction=desc(&|$)/);
  const {content} = await new ApiClient().fetchOwnerPage({sort: 'city', direction: 'desc'});
  await expect.poll(() => listedNames(this), {timeout: 10_000}).toEqual(content.map(gridName));
});
