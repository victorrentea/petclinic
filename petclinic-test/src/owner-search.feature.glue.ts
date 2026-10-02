import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ListedOwner, PlaywrightWorld} from './support/world';
import {ApiClient, OwnerDto} from './support/api-client';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides an order: where one is asserted, the API answering the same
// query is the oracle, so the database's collation is never re-implemented here.

const LIST_REQUEST = /\/api\/owners(\?|$)/;

const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);
const api = new ApiClient();

const listed = (owners: OwnerDto[]): ListedOwner[] =>
  owners.map((o) => ({id: o.id, name: `${o.firstName} ${o.lastName}`}));

/** The owners on screen, read off the rows: the id from the link, the name from its text. */
async function ownersOnScreen(world: PlaywrightWorld): Promise<ListedOwner[]> {
  const links = world.page.locator('#ownersTable td.ownerFullName a');
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  const names = await links.allTextContents();
  return hrefs.map((href, i) => ({id: Number(href.split('/').pop()), name: names[i].trim()}));
}

const rangeLabel = (world: PlaywrightWorld) =>
  world.page.locator('.mat-mdc-paginator-range-label').innerText().then((t) => t.trim());

/** Runs a UI action and waits until the list request it triggers has been answered. */
async function andTheListAnswers(world: PlaywrightWorld, action: () => Promise<unknown>): Promise<void> {
  await Promise.all([
    world.page.waitForResponse((r) => LIST_REQUEST.test(r.url()) && r.request().method() === 'GET'),
    action(),
  ]);
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const names = async () => (await ownersOnScreen(world)).map((o) => o.name).sort();
  await expect.poll(names, {timeout: 10_000}).toEqual([...expected].sort());
}

/** Polls until the table shows exactly these owners, in this order. */
async function expectOwnersInOrder(world: PlaywrightWorld, expected: ListedOwner[]): Promise<void> {
  await expect.poll(() => ownersOnScreen(world), {timeout: 10_000}).toEqual(expected);
}

/**
 * Remembers every owner the clinic holds, walking the API a page at a time, after
 * checking that the ones the Background names are among them — so a changed seed
 * (Flyway's db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = listed(await api.fetchEveryOwner());
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(all.length).toBe((await api.fetchOwnerPage({})).totalElements);
  expect(new Set(all.map((o) => o.id)).size).toBe(all.length);
  expect(all.map((o) => o.name)).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwners = all;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await andTheListAnswers(this, () => this.page.goto('/owners'));
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await andTheListAnswers(this, () => this.page.locator('#search-owner-form button[type="submit"]').click());
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('.mat-mdc-paginator-page-size-select').click();
  await andTheListAnswers(this, () => this.page.locator('mat-option', {hasText: String(size)}).click());
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  const before = await rangeLabel(this);
  await andTheListAnswers(this, () => this.page.locator('.mat-mdc-paginator-navigation-next').click());
  await expect.poll(() => rangeLabel(this)).not.toBe(before);
});

When('I walk to the last page', async function (this: PlaywrightWorld) {
  const next = this.page.locator('.mat-mdc-paginator-navigation-next');
  const walked: ListedOwner[] = [];
  for (;;) {
    walked.push(...await ownersOnScreen(this));
    if (await next.isDisabled()) {
      break;
    }
    const before = await rangeLabel(this);
    await andTheListAnswers(this, () => next.click());
    await expect.poll(() => rangeLabel(this)).not.toBe(before);
  }
  this.walkedOwners = walked;
});

When('I sort by {string}', async function (this: PlaywrightWorld, column: string) {
  const header = this.page.locator('#ownersTable th', {hasText: column});
  await andTheListAnswers(this, () => header.click());
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners by {string} are listed, in order',
  async function (this: PlaywrightWorld, size: number, sort: string) {
    await expectOwnersInOrder(this, listed((await api.fetchOwnerPage({size, sort})).content));
  });

Then('the owners named {string} by {string} are listed, in order',
  async function (this: PlaywrightWorld, lastName: string, sort: string) {
    await expectOwnersInOrder(this, listed((await api.fetchOwnerPage({lastName, sort})).content));
  });

Then('the range reads {string} of every owner in the clinic', async function (this: PlaywrightWorld, range: string) {
  await expect.poll(() => rangeLabel(this)).toBe(`${range} of ${this.requireAllOwners().length}`);
});

Then('the range reads {string}', async function (this: PlaywrightWorld, range: string) {
  await expect.poll(() => rangeLabel(this)).toBe(range);
});

Then('every owner in the clinic was listed once, in name order', async function (this: PlaywrightWorld) {
  expect(this.walkedOwners).toEqual(this.requireAllOwners());
});
