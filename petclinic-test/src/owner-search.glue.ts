import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {fetchAllOwners, fullName} from './support/api-client';
import {OWNER_NAME_CELL, listedOwners} from './support/owners-grid';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set, and the ordered
// tables state the exact rows the seeded clinic puts on that page.
//
// Why the default-view scenario submits an empty search instead of just loading
// the page: the browser's OTel SDK registers its XHR instrumentation only after
// an async collector-reachability check resolves, so the request the component
// fires on its own init escapes tracing and the @generate_sequence diagram would
// come out empty. A submit after load is the round-trip the diagram can see —
// and an empty last name asks for exactly the default view anyway.

const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const sorted = async () => (await listedOwners(world.page)()).sort();

  await expect.poll(sorted, {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table has settled on exactly `expected`, in that order. */
async function expectOwnersListedInOrder(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(listedOwners(world.page), {timeout: 10_000}).toEqual(expected);
}

async function waitForTheGrid(world: PlaywrightWorld): Promise<void> {
  await world.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
  // Wait for data, not just the heading: the h2 renders before the request resolves.
  await world.page.locator(OWNER_NAME_CELL).first()
      .waitFor({state: 'visible', timeout: 10_000});
}

/**
 * Counts every owner the clinic holds — one page at a time, since a request now
 * returns at most 20 — after checking that the ones the Background names are among
 * them, so a changed seed (Flyway's V3__sample_data.sql) fails on the Given instead
 * of looking like a broken search or a wrong page.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await fetchAllOwners();
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(all.map(fullName)).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.ownerTotal = all.length;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await waitForTheGrid(this);
});

When('I open the owners page at {string}', async function (this: PlaywrightWorld, query: string) {
  await this.page.goto(`/owners${query}`);
  await waitForTheGrid(this);
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the owners listed, in order, are', async function (this: PlaywrightWorld, owners: DataTable) {
  await expectOwnersListedInOrder(this, owners.raw().map(([name]) => name.trim()));
});

/**
 * The pager's own label is the only place the grid states how many owners exist
 * beyond the page on screen. Matched as a standalone number rather than against a
 * fixed sentence, so a reworded or localised Material range label still counts.
 */
Then('the pager reports every owner in the clinic', async function (this: PlaywrightWorld) {
  const total = this.requireOwnerTotal();
  const pagerText = async () => (await this.page.locator('mat-paginator').innerText()).replace(/\s+/g, ' ');

  await expect.poll(pagerText, {timeout: 10_000}).toMatch(new RegExp(`\\b${total}\\b`));
});
