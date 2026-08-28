import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {fetchAllOwners, fullName} from './support/owners-api';
import {listedOwners, nameCells} from './support/owners-grid';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.
//
// Owner lists are Gherkin data tables, never a comma-separated cell: a name now
// reads "Potter, Harry", so a comma no longer separates two owners (design D5).
//
// The steps this file defines are shared with owners-pagination.feature; the
// paging-specific ones live in owners-pagination.glue.ts.

const rowsOf = (table: DataTable) => table.raw().map(([name]) => name.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
export async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const listed = async () => (await listedOwners(world.page)).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * V3__sample_data.sql) fails on the Given instead of looking like a broken search.
 *
 * The endpoint is paged now, so this walks every page: a single call would only
 * see the first 10 owners and the Background would fail on the 11th.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await fetchAllOwners();
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  const names = all.map(fullName);
  expect(names).toEqual(expect.arrayContaining(rowsOf(owners)));
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

Then('exactly these owners are listed', async function (this: PlaywrightWorld, owners: DataTable) {
  await expectOwnersListed(this, rowsOf(owners));
});

Then('no owners are listed', async function (this: PlaywrightWorld) {
  await expect.poll(() => nameCells(this.page).count(), {timeout: 10_000}).toBe(0);
});
