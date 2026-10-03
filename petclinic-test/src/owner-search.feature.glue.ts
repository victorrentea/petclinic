import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {everyOwnerByName, ownerPage} from './support/owners-api';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set, and every expected
// order is the API's own answer for that sort.

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

const ownersTable = (world: PlaywrightWorld) => world.page.locator('#ownersTable');
const rangeLabel = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-range-label');

async function listedNames(world: PlaywrightWorld): Promise<string[]> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  return (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);
}

/** Waits for the latest page request to have answered. */
async function settled(world: PlaywrightWorld): Promise<void> {
  await expect(ownersTable(world)).toHaveAttribute('aria-busy', 'false', {timeout: 10_000});
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const sorted = async () => (await listedNames(world)).sort();
  await expect.poll(sorted, {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Remembers every owner the clinic holds, in name order, after checking that the
 * ones the Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const names = (await everyOwnerByName()).map(fullName);
  if (names.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = names;
});

Given('the clinic has more than {int} owners', async function (this: PlaywrightWorld, count: number) {
  expect(this.requireAllOwnerNames().length).toBeGreaterThan(count);
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
  await settled(this);
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('.mat-mdc-paginator-page-size-select').click();
  await this.page.locator('mat-option', {hasText: String(size)}).click();
  await expect(rangeLabel(this)).toContainText(`1 – ${size} of`);
  await settled(this);
});

When('I go to the next page of owners', async function (this: PlaywrightWorld) {
  const before = await rangeLabel(this).textContent();
  await this.page.locator('.mat-mdc-paginator-navigation-next').click();
  await expect(rangeLabel(this)).not.toHaveText(before ?? '');
  await settled(this);
});

When('I page through to the last page', async function (this: PlaywrightWorld) {
  const next = this.page.locator('.mat-mdc-paginator-navigation-next');
  const listed = await listedNames(this);
  while (await next.isEnabled()) {
    const before = await rangeLabel(this).textContent();
    await next.click();
    await expect(rangeLabel(this)).not.toHaveText(before ?? '');
    await settled(this);
    listed.push(...await listedNames(this));
  }
  this.listedOwnerNames = listed;
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  const header = this.page.locator('#ownersTable th[mat-sort-header]', {hasText: column});
  const before = await header.getAttribute('aria-sort');
  await header.click();
  await expect(header).not.toHaveAttribute('aria-sort', before ?? '');
  await settled(this);
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners sorted by {string} are listed, in order',
  async function (this: PlaywrightWorld, size: number, sort: string) {
    const expected = (await ownerPage({page: 0, size, sort})).content.map(fullName);
    await expect.poll(() => listedNames(this), {timeout: 10_000}).toEqual(expected);
  });

Then('the range shows {string} of every owner in the clinic', async function (this: PlaywrightWorld, range: string) {
  await expect(rangeLabel(this)).toHaveText(`${range} of ${this.requireAllOwnerNames().length}`);
});

Then('the range shows {string} of {int}', async function (this: PlaywrightWorld, range: string, total: number) {
  await expect(rangeLabel(this)).toHaveText(`${range} of ${total}`);
});

Then('every owner in the clinic was listed once, in name order', async function (this: PlaywrightWorld) {
  expect(this.listedOwnerNames).toEqual(this.requireAllOwnerNames());
});
