import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {OwnersPage} from './pages/OwnersPage';

// Gherkin, bound straight to the page objects: no DSL layer in between — the .feature
// is the readable artefact here, and a second naming of the same sentences would only
// add indirection. (add-visit.spec.ts makes the opposite case: no Gherkin, sentences as
// a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const owners = new OwnersPage(world.page);
  const listed = async () => (await owners.listedOwnerNames()).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/** The API answers one page at a time (GH #25): walk them all, 20 by 20, in the grid's default order. */
async function everyOwnerByName(): Promise<string[]> {
  const names: string[] = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${API_BASE}/owners?size=20&sort=name&page=${page}`, {timeout: 10_000});
    names.push(...data.content.map(fullName));
    if (page + 1 >= data.totalPages) {
      return names;
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
  const names = await everyOwnerByName();
  if (names.length === 0) {
    throw new Error('The API returned no owners — is the backend up, and was the DB reset to ' +
      'the @fixture:default this feature declares?');
  }
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = names;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await OwnersPage.open(this.page);
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await new OwnersPage(this.page).searchByLastName(search);
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first 10 owners by name are listed, out of all of them', async function (this: PlaywrightWorld) {
  const all = this.requireAllOwnerNames();
  await expectOwnersListed(this, all.slice(0, 10));
  await expect(new OwnersPage(this.page).rangeLabel).toHaveText(`1 – ${Math.min(10, all.length)} of ${all.length}`);
});
