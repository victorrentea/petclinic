import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ListedOwner, PlaywrightWorld} from './support/world';
import {everyOwner, ownersPage} from './support/owners-api';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set, and the API says
// in which order a sorted page lists them.

interface OwnerDto {id: number; firstName: string; lastName: string}

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const listed = (o: OwnerDto): ListedOwner => ({id: o.id, name: fullName(o)});
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

async function rowsOnScreen(world: PlaywrightWorld): Promise<ListedOwner[]> {
  return world.page.locator('#ownersTable td.ownerFullName a').evaluateAll((links) =>
    links.map((a) => ({
      id: Number(a.getAttribute('href')?.split('/').pop()),
      name: (a.textContent || '').trim().replace(/\s+/g, ' '),
    })));
}

/**
 * Does `action`, then waits until the table shows exactly the page the API answered with.
 * The paginator moves its range label on the click, before the answer arrives, so the label
 * alone cannot tell a settled page from one still loading.
 */
async function andWaitForThePage(world: PlaywrightWorld, action: () => Promise<unknown>): Promise<void> {
  const answer = world.page.waitForResponse((r) =>
    new URL(r.url()).pathname.endsWith('/api/owners') && r.request().method() === 'GET', {timeout: 10_000});
  await action();
  const {content} = (await (await answer).json()) as {content: OwnerDto[]};
  await expect.poll(() => rowsOnScreen(world), {timeout: 10_000}).toEqual(content.map(listed));
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const names = async () => (await rowsOnScreen(world)).map((o) => o.name).sort();
  await expect.poll(names, {timeout: 10_000}).toEqual([...expected].sort());
}

async function expectPaginatorToRead(world: PlaywrightWorld, label: string): Promise<void> {
  await expect(world.page.locator('mat-paginator .mat-mdc-paginator-range-label')).toHaveText(label);
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = (await everyOwner()).map(listed);
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(all.map((o) => o.name)).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwners = all;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await andWaitForThePage(this, () => this.page.goto('/owners'));
  this.pagedOwners.push(...await rowsOnScreen(this));
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await andWaitForThePage(this, () => this.page.locator('#search-owner-form button[type="submit"]').click());
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await andWaitForThePage(this, () => this.page.getByRole('button', {name: 'Next page'}).click());
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await andWaitForThePage(this, () =>
    this.page.getByRole('option', {name: String(size), exact: true}).click());
  this.pagedOwners = await rowsOnScreen(this);
});

When('I page through to the last page', async function (this: PlaywrightWorld) {
  const next = this.page.getByRole('button', {name: 'Next page'});
  while (await next.isEnabled()) {
    await andWaitForThePage(this, () => next.click());
    this.pagedOwners.push(...await rowsOnScreen(this));
  }
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await andWaitForThePage(this, () =>
    this.page.locator('#ownersTable th[mat-sort-header]', {hasText: column}).click());
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners by name are listed, out of every owner in the clinic',
  async function (this: PlaywrightWorld, count: number) {
    const all = this.requireAllOwners();
    expect(await rowsOnScreen(this)).toEqual(all.slice(0, count));
    await expectPaginatorToRead(this, `1 – ${count} of ${all.length}`);
  });

Then('the first {int} owners by {string} are listed',
  async function (this: PlaywrightWorld, count: number, sort: string) {
    const {content} = await ownersPage(0, count, sort);
    expect(await rowsOnScreen(this)).toEqual(content.map(listed));
  });

Then('every owner in the clinic was listed once, in name order', async function (this: PlaywrightWorld) {
  const all = this.requireAllOwners();
  expect(all.length).toBeGreaterThan(20);
  expect(new Set(this.pagedOwners.map((o) => o.id)).size).toBe(this.pagedOwners.length);
  expect(this.pagedOwners).toEqual(all);
});

Then('the paginator reads {string}', async function (this: PlaywrightWorld, label: string) {
  await expectPaginatorToRead(this, label);
});
