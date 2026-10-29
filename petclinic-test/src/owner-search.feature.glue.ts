import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// As the grid shows a name: last name first, the way names are written in Romania (#25).
const fullName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

const ownerCells = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');
const namesListed = async (world: PlaywrightWorld) =>
  (await ownerCells(world).allTextContents()).map((t) => t.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await namesListed(world)).sort(), {timeout: 10_000}).toEqual([...expected].sort());
}

/** Every name the grid shows, page after page, until the paginator's Next button gives out. */
async function namesOnEveryPage(world: PlaywrightWorld): Promise<string[]> {
  const next = world.page.locator('.mat-mdc-paginator-navigation-next');
  const names: string[] = [];
  for (;;) {
    await expect(ownerCells(world).first()).toBeVisible();
    const onThisPage = await namesListed(world);
    names.push(...onThisPage);
    if (await next.isDisabled()) {
      return names;
    }
    await next.click();
    await expect(ownerCells(world).first()).not.toHaveText(onThisPage[0]);
  }
}

/** Every owner the API holds, page by page: no request may ask for all of them at once. */
async function allOwners(): Promise<{firstName: string; lastName: string}[]> {
  const owners = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {page, size: 20}, timeout: 10_000});
    owners.push(...data.content);
    if (owners.length >= data.totalElements || data.content.length === 0) {
      return owners;
    }
  }
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql, which the feature asks for with @fixture:default) fails on
 * the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const data = await allOwners();
  if (data.length === 0) {
    throw new Error('The API returned no owners — is the backend up, and was the DB reset to ' +
      'the @fixture:default this feature declares?');
  }
  const names: string[] = data.map(fullName);
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

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('every owner in the clinic is listed', async function (this: PlaywrightWorld) {
  expect((await namesOnEveryPage(this)).sort()).toEqual([...this.requireAllOwnerNames()].sort());
});
