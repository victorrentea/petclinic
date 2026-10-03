import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ListedOwner, PlaywrightWorld} from './support/world';
import {fetchAllOwners, OwnerSort} from './support/owners-api';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);
const listed = (o: {id: number; firstName: string; lastName: string}): ListedOwner =>
  ({id: o.id, name: `${o.firstName} ${o.lastName}`});

const rows = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');

async function listedNames(world: PlaywrightWorld): Promise<string[]> {
  return (await rows(world).allTextContents()).map((t) => t.trim()).filter(Boolean);
}

/** Read off the links, so two owners sharing a name still count as two. */
async function listedIds(world: PlaywrightWorld): Promise<number[]> {
  const hrefs = await rows(world).locator('a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  return hrefs.map((href) => Number(href?.split('/').pop()));
}

/**
 * Remembers every owner the clinic holds, in name order, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's db/seed/R__seed.sql) fails
 * on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = (await fetchAllOwners('name,asc')).map(listed);
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(all.map((o) => o.name)).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
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
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await this.page.getByRole('button', {name: 'Next page'}).click();
});

When('I click the {string} header {int} time(s)', async function (
  this: PlaywrightWorld, column: string, clicks: number,
) {
  const header = this.page.locator('#ownersTable th', {hasText: column});
  for (let i = 0; i < clicks; i++) {
    await header.click();
  }
});

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  const sorted = async () => (await listedNames(this)).sort();
  await expect.poll(sorted, {timeout: 10_000}).toEqual(namesIn(owners).sort());
});

Then('these owners are listed in order: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expect.poll(() => listedNames(this), {timeout: 10_000}).toEqual(namesIn(owners));
});

Then('the first {int} owners by {word} are listed', async function (
  this: PlaywrightWorld, count: number, key: string,
) {
  const ordered = key === 'name'
    ? this.requireAllOwners()
    : (await fetchAllOwners(`${key},asc` as OwnerSort)).map(listed);
  const expectedIds = ordered.slice(0, count).map((o) => o.id);
  await expect.poll(() => listedIds(this), {timeout: 10_000}).toEqual(expectedIds);
});

Then('the range reads {string}', async function (this: PlaywrightWorld, range: string) {
  await expect(this.page.locator('.mat-mdc-paginator-range-label')).toHaveText(range);
});

Then('the range reads {string} of every owner in the clinic', async function (this: PlaywrightWorld, range: string) {
  const total = this.requireAllOwners().length;
  await expect(this.page.locator('.mat-mdc-paginator-range-label')).toHaveText(`${range} of ${total}`);
});

Then('paging to the end shows every owner once, in name order', async function (this: PlaywrightWorld) {
  const expectedIds = this.requireAllOwners().map((o) => o.id);
  const pageSize = Number((await this.page.locator('mat-paginator mat-select').textContent())?.trim());
  const next = this.page.getByRole('button', {name: 'Next page'});
  const seen: number[] = [];
  for (let start = 0; start < expectedIds.length; start += pageSize) {
    if (start > 0) {
      await next.click();
    }
    const pageIds = expectedIds.slice(start, start + pageSize);
    await expect.poll(() => listedIds(this), {timeout: 10_000}).toEqual(pageIds);
    seen.push(...pageIds);
  }
  await expect(next).toBeDisabled();
  expect(new Set(seen).size).toBe(expectedIds.length);
});
