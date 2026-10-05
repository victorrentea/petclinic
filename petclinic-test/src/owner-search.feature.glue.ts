import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {ClinicOwner, PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set. Every expected order
// is the API's own, read through the same paged endpoint the screen uses.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

interface OwnerPage {
  content: {id: number; firstName: string; lastName: string}[];
  totalElements: number;
}

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

async function fetchPage(params: Record<string, string | number>): Promise<OwnerPage> {
  const {data} = await axios.get<OwnerPage>(`${API_BASE}/owners`, {params, timeout: 10_000});
  return data;
}

/** Every owner, page by page in the API's default (name) order — no single request returns them all. */
async function fetchAllOwners(): Promise<ClinicOwner[]> {
  const owners: ClinicOwner[] = [];
  for (let page = 0; ; page++) {
    const {content, totalElements} = await fetchPage({page, size: 20});
    owners.push(...content.map((o) => ({id: o.id, name: fullName(o)})));
    if (content.length === 0 || owners.length >= totalElements) {
      return owners;
    }
  }
}

const rows = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerFullName');
const rangeLabel = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-range-label');

async function listedNames(world: PlaywrightWorld): Promise<string[]> {
  return (await rows(world).allTextContents()).map((t) => t.trim()).filter(Boolean);
}

async function listedIds(world: PlaywrightWorld): Promise<number[]> {
  const hrefs = await rows(world).locator('a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  return hrefs.map((href) => Number(href!.split('/').pop()));
}

/** Runs a UI action and waits until the list request it sent has been answered and rendered. */
async function andWaitForTheList(world: PlaywrightWorld, action: () => Promise<void>): Promise<void> {
  const listAnswered = world.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/api/owners'));
  await action();
  await listAnswered;
  await expect(world.page.locator('#ownersTable[aria-busy="true"]')).toHaveCount(0);
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  await expect.poll(async () => (await listedNames(world)).sort(), {timeout: 10_000})
    .toEqual([...expected].sort());
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  const all = await fetchAllOwners();
  if (all.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(new Set(all.map((o) => o.id)).size, 'API pages overlap').toBe(all.length);
  expect(all.map((o) => o.name)).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwners = all;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await andWaitForTheList(this, async () => {
    await this.page.goto('/owners');
  });
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await andWaitForTheList(this, () => this.page.locator('#search-owner-form button[type="submit"]').click());
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await andWaitForTheList(this, () => this.page.getByRole('button', {name: 'Next page'}).click());
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('.mat-mdc-paginator-page-size-select').click();
  await andWaitForTheList(this, () => this.page.getByRole('option', {name: String(size), exact: true}).click());
});

When('I sort by {string}', async function (this: PlaywrightWorld, column: string) {
  await andWaitForTheList(this, () => this.page.locator('#ownersTable th', {hasText: column}).click());
});

When('I page through the whole list', async function (this: PlaywrightWorld) {
  const next = this.page.getByRole('button', {name: 'Next page'});
  this.pagedOwnerIds = await listedIds(this);
  while (await next.isEnabled()) {
    await andWaitForTheList(this, () => next.click());
    this.pagedOwnerIds.push(...await listedIds(this));
  }
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first {int} owners by name are listed', async function (this: PlaywrightWorld, count: number) {
  const expected = this.requireAllOwners().slice(0, count).map((o) => o.name);
  await expect.poll(() => listedNames(this), {timeout: 10_000}).toEqual(expected);
});

Then('the range shows owners {int} to {int} of every owner in the clinic',
  async function (this: PlaywrightWorld, from: number, to: number) {
    await expect(rangeLabel(this)).toHaveText(`${from} – ${to} of ${this.requireAllOwners().length}`);
  });

Then('the range shows owners {int} to {int} of {int}',
  async function (this: PlaywrightWorld, from: number, to: number, total: number) {
    await expect(rangeLabel(this)).toHaveText(`${from} – ${to} of ${total}`);
  });

Then('every owner in the clinic was listed exactly once, in name order', function (this: PlaywrightWorld) {
  expect(this.pagedOwnerIds).toEqual(this.requireAllOwners().map((o) => o.id));
});

Then('the owners are listed as the API orders them for {string}',
  async function (this: PlaywrightWorld, sort: string) {
    const {content} = await fetchPage({sort});
    await expect.poll(() => listedNames(this), {timeout: 10_000}).toEqual(content.map(fullName));
  });
