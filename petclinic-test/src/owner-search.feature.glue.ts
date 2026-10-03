import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ApiClient, OwnerDto, OwnerPageParams} from './support/api-client';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const api = new ApiClient();

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

const ownerLinks = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');
const rangeLabel = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-range-label');

const listedNames = async (world: PlaywrightWorld) =>
  (await ownerLinks(world).allTextContents()).map((t) => t.trim()).filter(Boolean);

const listedIds = async (world: PlaywrightWorld) =>
  (await ownerLinks(world).locator('a').evaluateAll((links) => links.map((a) => a.getAttribute('href'))))
    .map((href) => Number(href?.split('/').pop()));

/** Waits for the range label, then for the rows of that range to have arrived. */
async function expectRange(world: PlaywrightWorld, label: string): Promise<void> {
  await expect(rangeLabel(world)).toHaveText(label, {timeout: 10_000});
  await expect(world.page.locator('#ownersTable')).toHaveAttribute('aria-busy', 'false', {timeout: 10_000});
}

const rangeOf = (from: number, to: number, total: number) => `${from} – ${to} of ${total}`;

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  if (expected.length === 0) {
    await expect(world.page.locator('#noOwners')).toBeVisible({timeout: 10_000});
  }
  const sorted = async () => (await listedNames(world)).sort();
  await expect.poll(sorted, {timeout: 10_000}).toEqual([...expected].sort());
}

async function expectOwnerIdsListed(world: PlaywrightWorld, owners: OwnerDto[]): Promise<void> {
  await expect.poll(() => listedIds(world), {timeout: 10_000}).toEqual(owners.map((o) => o.id));
}

/**
 * Remembers every owner the clinic holds, read a page at a time, after checking that the
 * ones the Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await api.fetchAllOwners();
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
  await this.page.locator('.mat-mdc-paginator-page-size-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
  await expectRange(this, rangeOf(1, Math.min(size, this.requireAllOwners().length), this.requireAllOwners().length));
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  const before = await rangeLabel(this).textContent();
  await this.page.locator('.mat-mdc-paginator-navigation-next').click();
  await expect(rangeLabel(this)).not.toHaveText(before ?? '', {timeout: 10_000});
  await expect(this.page.locator('#ownersTable')).toHaveAttribute('aria-busy', 'false', {timeout: 10_000});
});

When('I page forward to the last page', async function (this: PlaywrightWorld) {
  const next = this.page.locator('.mat-mdc-paginator-navigation-next');
  const seen: number[] = [];
  for (;;) {
    await expect(this.page.locator('#ownersTable')).toHaveAttribute('aria-busy', 'false', {timeout: 10_000});
    seen.push(...await listedIds(this));
    if (await next.isDisabled()) {
      break;
    }
    const before = await rangeLabel(this).textContent();
    await next.click();
    await expect(rangeLabel(this)).not.toHaveText(before ?? '', {timeout: 10_000});
  }
  this.pagedOwnerIds = seen;
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await this.page.locator('#ownersTable th[mat-sort-header]', {hasText: column}).click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('exactly these owners are listed, in this order: {string}',
  async function (this: PlaywrightWorld, owners: string) {
    await expect.poll(() => listedNames(this), {timeout: 10_000}).toEqual(namesIn(owners));
  });

Then('the first 10 owners by name are listed, out of every owner in the clinic',
  async function (this: PlaywrightWorld) {
    const all = this.requireAllOwners();
    await expectOwnerIdsListed(this, all.slice(0, 10));
    await expectRange(this, rangeOf(1, Math.min(10, all.length), all.length));
  });

Then('every owner in the clinic was listed once, in name order', async function (this: PlaywrightWorld) {
  const all = this.requireAllOwners();
  expect(all.length, 'paging is only exercised by more owners than one page of 20 holds').toBeGreaterThan(20);
  expect(this.pagedOwnerIds).toEqual(all.map((o) => o.id));
});

Then('the first page lists the owners by {string}',
  async function (this: PlaywrightWorld, sort: OwnerPageParams['sort']) {
    const {content} = await api.fetchOwnerPage({sort, size: 10});
    await expectOwnerIdsListed(this, content);
  });

Then('the page shows owners {int} to {int} of every owner in the clinic',
  async function (this: PlaywrightWorld, from: number, to: number) {
    await expectRange(this, rangeOf(from, to, this.requireAllOwners().length));
  });

Then('the page shows owners {int} to {int} of {int}',
  async function (this: PlaywrightWorld, from: number, to: number, total: number) {
    await expectRange(this, rangeOf(from, to, total));
  });
