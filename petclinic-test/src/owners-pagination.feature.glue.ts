import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Steps bound directly, same as owner-search.feature.glue.ts — the .feature is
// the readable artefact, a DSL layer underneath would only add indirection.
//
// `I open the owners page` and `I search owners for "..."` are NOT redefined
// here: owner-search.feature.glue.ts already owns them, and Cucumber loads every
// glue file into one namespace, so a second definition is an ambiguous-step error.
//
// Every expected name and count in the .feature was verified against the seeded
// database (Flyway V3__sample_data.sql, 28 owners) before this file was written.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const ROWS = '#ownersTable td.ownerFullName';
const RANGE_LABEL = '.mat-mdc-paginator-range-label';
// By aria-label, not by class: Material renames its internals between versions.
const NEXT_PAGE = 'mat-paginator button[aria-label="Next page"]';
const PAGE_SIZE_SELECT = '.mat-mdc-paginator-page-size-select';
const PREV_PAGE = 'mat-paginator button[aria-label="Previous page"]';

/** Names as the grid currently renders them, in row order. */
async function namesOnPage(world: PlaywrightWorld): Promise<string[]> {
  const texts = await world.page.locator(ROWS).allTextContents();
  return texts.map((t) => t.trim()).filter(Boolean);
}

/** The paginator's "1 – 10 of 28" label, which is how the screen reports totals. */
async function rangeLabel(world: PlaywrightWorld): Promise<string> {
  return (await world.page.locator(RANGE_LABEL).innerText()).replace(/\s+/g, ' ').trim();
}

async function canGoToNextPage(world: PlaywrightWorld): Promise<boolean> {
  return !(await world.page.locator(NEXT_PAGE).isDisabled());
}

/** Walks from the current page to the last, collecting every name in order. */
async function walkAllPages(world: PlaywrightWorld): Promise<{names: string[]; pages: number}> {
  const names: string[] = [];
  let pages = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    names.push(...(await namesOnPage(world)));
    pages++;
    if (!(await canGoToNextPage(world))) break;
    const before = (await namesOnPage(world))[0];
    await world.page.locator(NEXT_PAGE).click();
    await expect.poll(async () => (await namesOnPage(world))[0]).not.toBe(before);
  }
  return {names, pages};
}

/** Clicks a sortable column header until it reports the wanted direction. */
async function sortBy(world: PlaywrightWorld, column: string, direction: 'ascending' | 'descending') {
  const header = world.page.locator(`#ownersTable th`, {hasText: new RegExp(`^\\s*${column}\\s*$`)});
  for (let click = 0; click < 3; click++) {
    if ((await header.getAttribute('aria-sort')) === direction) return;
    await header.click();
    await world.page.waitForTimeout(150);
  }
  expect(await header.getAttribute('aria-sort')).toBe(direction);
}

Given('the clinic has {int} owners', async function (this: PlaywrightWorld, expected: number) {
  const {data} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  if (typeof data?.totalElements !== 'number') {
    throw new Error(
      'The owners API did not report a total — expected a page with totalElements. ' +
        'Is the backend up, seeded by Flyway, and serving the paged listing?'
    );
  }
  expect(data.totalElements).toBe(expected);
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator(PAGE_SIZE_SELECT).click();
  await this.page.locator(`mat-option`, {hasText: new RegExp(`^\\s*${size}\\s*$`)}).click();
  await expect.poll(async () => (await namesOnPage(this)).length).toBeLessThanOrEqual(size);
});

When('I go to page {int}', async function (this: PlaywrightWorld, page: number) {
  for (let step = 1; step < page; step++) {
    const before = (await namesOnPage(this))[0];
    await this.page.locator(NEXT_PAGE).click();
    await expect.poll(async () => (await namesOnPage(this))[0]).not.toBe(before);
  }
});

When('I go to the last page', async function (this: PlaywrightWorld) {
  while (await canGoToNextPage(this)) {
    const before = (await namesOnPage(this))[0];
    await this.page.locator(NEXT_PAGE).click();
    await expect.poll(async () => (await namesOnPage(this))[0]).not.toBe(before);
  }
});

When('I sort by {word}', async function (this: PlaywrightWorld, column: string) {
  await sortBy(this, column, 'ascending');
});

When('I sort by {word} in reverse', async function (this: PlaywrightWorld, column: string) {
  await sortBy(this, column, 'descending');
});

When('I step through all {int} pages', async function (this: PlaywrightWorld, expectedPages: number) {
  const {names, pages} = await walkAllPages(this);
  expect(pages).toBe(expectedPages);
  this.firstWalk = names;
});

When('I step through all {int} pages again', async function (this: PlaywrightWorld, expectedPages: number) {
  // The first walk ended on the last page, and the URL faithfully kept it there, so
  // walk back to the start before setting off again.
  while (!(await this.page.locator(PREV_PAGE).isDisabled())) {
    const before = (await namesOnPage(this))[0];
    await this.page.locator(PREV_PAGE).click();
    await expect.poll(async () => (await namesOnPage(this))[0]).not.toBe(before);
  }
  const {names, pages} = await walkAllPages(this);
  expect(pages).toBe(expectedPages);
  this.secondWalk = names;
});

When('I reload the page', async function (this: PlaywrightWorld) {
  await this.page.reload();
  await expect.poll(async () => (await namesOnPage(this)).length).toBeGreaterThan(0);
});

Then('I see {int} owners', async function (this: PlaywrightWorld, expected: number) {
  await expect.poll(async () => (await namesOnPage(this)).length).toBe(expected);
});

Then('the first owner is {string}', async function (this: PlaywrightWorld, name: string) {
  await expect.poll(async () => (await namesOnPage(this))[0]).toBe(name);
});

Then('the last owner is {string}', async function (this: PlaywrightWorld, name: string) {
  await expect.poll(async () => (await namesOnPage(this)).at(-1)).toBe(name);
});

Then('I am told there are {int} owners in total', async function (this: PlaywrightWorld, total: number) {
  await expect.poll(() => rangeLabel(this)).toContain(`of ${total}`);
});

Then('I can step through {int} pages', async function (this: PlaywrightWorld, expected: number) {
  const {pages} = await walkAllPages(this);
  expect(pages).toBe(expected);
});

Then('{string} is listed immediately before {string}', async function (
  this: PlaywrightWorld, first: string, second: string) {
  const names = await namesOnPage(this);
  expect(names).toContain(first);
  expect(names.indexOf(second)).toBe(names.indexOf(first) + 1);
});

Then('{string} is listed between {string} and {string}', async function (
  this: PlaywrightWorld, middle: string, before: string, after: string) {
  const names = await namesOnPage(this);
  expect(names).toContain(middle);
  expect(names.indexOf(before)).toBeLessThan(names.indexOf(middle));
  expect(names.indexOf(middle)).toBeLessThan(names.indexOf(after));
});

Then('I have seen all {int} owners', function (this: PlaywrightWorld, total: number) {
  expect(this.requireFirstWalk()).toHaveLength(total);
});

Then('no owner was shown twice', function (this: PlaywrightWorld) {
  const names = this.requireFirstWalk();
  const seenTwice = names.filter((n, i) => names.indexOf(n) !== i);
  expect(seenTwice, `shown on more than one page: ${seenTwice.join(', ')}`).toEqual([]);
});

Then('no owner was missed', async function (this: PlaywrightWorld) {
  const {data} = await axios.get(`${API_BASE}/owners?size=20&page=0`, {timeout: 10_000});
  const {data: rest} = await axios.get(`${API_BASE}/owners?size=20&page=1`, {timeout: 10_000});
  const everyone = [...data.content, ...rest.content].map(
    (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`
  );
  const missed = everyone.filter((n) => !this.requireFirstWalk().includes(n));
  expect(missed, `never appeared on any page: ${missed.join(', ')}`).toEqual([]);
});

Then('both walks listed the owners in the same order', function (this: PlaywrightWorld) {
  expect(this.secondWalk).toEqual(this.requireFirstWalk());
});

Then('the owners living in {string} are listed one after another', async function (
  this: PlaywrightWorld, city: string) {
  const cells = await this.page.locator('#ownersTable tbody tr').allTextContents();
  const flags = cells.map((row) => row.includes(city));
  const first = flags.indexOf(true);
  const last = flags.lastIndexOf(true);
  expect(first, `no owner from ${city} on this page`).toBeGreaterThanOrEqual(0);
  expect(flags.slice(first, last + 1).every(Boolean),
    `owners from ${city} are interrupted by owners from elsewhere`).toBe(true);
});

Then('I am looking at the first page', async function (this: PlaywrightWorld) {
  await expect.poll(() => rangeLabel(this)).toMatch(/^1\s/);
});

Then('I am told that no owners were found', async function (this: PlaywrightWorld) {
  await expect(this.page.getByText(/No owners/i)).toBeVisible();
});

Then('I am still on page {int}', async function (this: PlaywrightWorld, page: number) {
  const size = Number(new URL(this.page.url()).searchParams.get('size'));
  const firstRow = (page - 1) * size + 1;
  await expect.poll(() => rangeLabel(this)).toMatch(new RegExp(`^${firstRow}\\s`));
});

Then('I am still showing {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await expect.poll(async () => (await namesOnPage(this)).length).toBe(size);
});

Then('the owners are still sorted by {word}', async function (this: PlaywrightWorld, column: string) {
  const header = this.page.locator('#ownersTable th', {hasText: new RegExp(`^\\s*${column}\\s*$`)});
  expect(await header.getAttribute('aria-sort')).toBe('ascending');
});
