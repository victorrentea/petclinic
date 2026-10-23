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

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/** The API serves at most 20 owners a page: walk the pages to get them all. */
async function everyOwnerInTheApi(): Promise<{firstName: string; lastName: string}[]> {
  const owners: {firstName: string; lastName: string}[] = [];
  for (let page = 0; ; page++) {
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {page, size: 20}, timeout: 10_000});
    owners.push(...data.content);
    if (data.content.length === 0 || owners.length >= data.totalElements) return owners;
  }
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql, which the feature asks for with @fixture:default) fails on
 * the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const allOwners = await everyOwnerInTheApi();
  if (allOwners.length === 0) {
    throw new Error('The API returned no owners — is the backend up, and was the DB reset to ' +
      'the @fixture:default this feature declares?');
  }
  const names: string[] = allOwners.map(fullName);
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

Then('every owner in the clinic is listed, {int} per page', async function (this: PlaywrightWorld, pageSize: number) {
  const everyOwner = this.requireAllOwnerNames();
  const cells = this.page.locator('#ownersTable td.ownerFullName');
  const rangeLabel = this.page.locator('#ownersTable .mat-mdc-paginator-range-label');
  const nextPage = this.page.getByRole('button', {name: 'Next page'});
  await expect(rangeLabel).toHaveText(`Page 1 – 1..${Math.min(pageSize, everyOwner.length)} of ${everyOwner.length}`);

  const listed: string[] = [];
  for (let page = 0; ; page++) {
    const first = page * pageSize + 1;
    await expect(rangeLabel).toHaveText(
      new RegExp(`^\\s*Page ${page + 1} – ${first}\\.\\.\\d+ of ${everyOwner.length}\\s*$`));
    const onThisPage = (await cells.allTextContents()).map((t) => t.trim());
    expect(onThisPage.length).toBeLessThanOrEqual(pageSize);
    listed.push(...onThisPage);
    if (await nextPage.isDisabled()) break;
    await nextPage.click();
    // The paginator's label moves on at the click; the rows only when the server answers.
    await expect.poll(async () => (await cells.allTextContents()).map((t) => t.trim()), {timeout: 10_000})
      .not.toEqual(onThisPage);
  }
  expect(listed.sort()).toEqual([...everyOwner].sort());
});
