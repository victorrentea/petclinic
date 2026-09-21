import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {fetchAllOwners, OwnerSummary, PageEnvelope} from './support/api-client';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// Surname first, exactly as the grid renders it — ordering by last name is illegible with
// the given name in front. That comma is inside every name now, so the feature's lists of
// expected owners are separated by `;`: splitting them on `,` would tear each name in two
// and then compare the halves, silently, against a table that no longer means what it says.
const fullName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Checks that the owners the Background names are among the ones the clinic holds — so a
 * changed seed (Flyway's db/seed/R__seed.sql) fails on the Given instead of looking like
 * a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const names = (await fetchAllOwners(API_BASE)).map(fullName);
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
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

/**
 * The grid pages, so an empty search shows the first `size` of `totalElements` owners —
 * never the clinic. The expectation is therefore the API's own first page, asked for with
 * the same defaults the grid uses, and deliberately not a walk over every page: rebuilding
 * the whole list here would only be this test re-implementing the endpoint and then
 * agreeing with itself.
 */
Then('the first page of owners is listed', async function (this: PlaywrightWorld) {
  const {data} = await axios.get<PageEnvelope<OwnerSummary>>(`${API_BASE}/owners`, {timeout: 10_000});
  const onFirstPage = data?.content;
  if (!Array.isArray(onFirstPage)) {
    throw new Error(`GET ${API_BASE}/owners did not answer a page envelope; got: ` +
      JSON.stringify(data).slice(0, 200));
  }

  expect(onFirstPage.length,
    `A page of ${data.size} over ${data.totalElements} owners should hold ` +
    `${Math.min(data.size, data.totalElements)} of them, but the API returned ` +
    `${onFirstPage.length}`).toBe(Math.min(data.size, data.totalElements));

  await expectOwnersListed(this, onFirstPage.map(fullName));
});
