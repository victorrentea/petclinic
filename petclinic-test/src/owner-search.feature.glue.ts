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

/**
 * Remembers how many owners the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql, which the feature asks for with @fixture:default) fails on
 * the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const {data: page} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  if (!page?.totalElements) {
    throw new Error('The API returned no owners — is the backend up, and was the DB reset to ' +
      'the @fixture:default this feature declares?');
  }
  for (const [name] of owners.raw()) {
    const lastName = name.trim().split(' ').pop();
    const {data: matches} = await axios.get(`${API_BASE}/owners`, {params: {lastName, size: 20}, timeout: 10_000});
    expect(matches.content.map(fullName)).toContain(name.trim());
  }
  this.ownerCount = page.totalElements;
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

const listedCells = (world: PlaywrightWorld, cssClass: string) =>
  world.page.locator(`#ownersTable td${cssClass}`).allTextContents();
const paginatorRange = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-range-label');

When('I choose {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

When('I sort owners by city', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersTable th', {hasText: 'City'}).click();
  await expect(this.page).toHaveURL(/sort=city/);
});

When('I go to the next page of owners', async function (this: PlaywrightWorld) {
  await this.page.locator('mat-paginator button.mat-mdc-paginator-navigation-next').click();
  await expect(this.page).toHaveURL(/page=1/);
});

When('I open the first listed owner and go back', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersTable td.ownerFullName a').first().click();
  await expect(this.page).toHaveURL(/\/owners\/\d+/);
  await this.page.goBack();
});

Then('the first page lists {int} owners out of every owner in the clinic',
  async function (this: PlaywrightWorld, size: number) {
    await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(size);
    await expect(paginatorRange(this)).toHaveText(new RegExp(`^\\s*1 – ${size} of ${this.requireOwnerCount()}\\s*$`));
  });

Then('the listed owners are in alphabetical order of city', async function (this: PlaywrightWorld) {
  const collator = new Intl.Collator('und');
  const cityColumn = 3;
  await expect.poll(async () => {
    const cities = (await listedCells(this, `:nth-child(${cityColumn})`)).map((c) => c.trim());
    return cities.length > 0 && cities.every((c, i) => i === 0 || collator.compare(cities[i - 1], c) <= 0);
  }, {timeout: 10_000}).toBe(true);
});

Then('page {int} sorted by city is shown', async function (this: PlaywrightWorld, pageNumber: number) {
  await expect(this.page).toHaveURL(new RegExp(`page=${pageNumber - 1}`));
  await expect(this.page).toHaveURL(/sort=city/);
  const size = 10;
  const first = (pageNumber - 1) * size + 1;
  await expect(paginatorRange(this)).toHaveText(new RegExp(`^\\s*${first} – ${first + size - 1} of`));
});
