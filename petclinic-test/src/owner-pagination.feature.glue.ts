import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';

// Same stance as owner-search.feature.glue.ts: the steps do the work themselves, so the
// .feature stays the readable artefact. Nothing here decides anything the feature does not say.

const NAME_CELL = '#ownersTable td.ownerFullName';
const COLUMN_HEADERS: Record<string, string> = {Name: '#sortByName', City: '#sortByCity'};
/** Which cell of a row carries the value a column is sorted by. */
const COLUMN_CELLS: Record<string, string> = {
  Name: '#ownersTable td.ownerFullName',
  City: '#ownersTable tbody tr td:nth-child(3)',
};

async function namesOnScreen(world: PlaywrightWorld): Promise<string[]> {
  return (await world.page.locator(NAME_CELL).allTextContents()).map((t) => t.trim());
}

async function valuesOf(world: PlaywrightWorld, column: string): Promise<string[]> {
  return (await world.page.locator(COLUMN_CELLS[column]).allTextContents()).map((t) => t.trim());
}

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('#ownersPaginator mat-select, #ownersPaginator .mat-mdc-select').click();
  await this.page.locator(`mat-option:has-text("${size}")`).first().click();
  await expect.poll(() => namesOnScreen(this).then((n) => n.length), {timeout: 10_000})
    .toEqual(size);
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  this.previousPageNames = await namesOnScreen(this);
  await this.page.locator('#ownersPaginator button[aria-label="Next page"]').click();
  await expect
    .poll(() => namesOnScreen(this), {timeout: 10_000})
    .not.toEqual(this.previousPageNames);
});

When('I go to the previous page', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersPaginator button[aria-label="Previous page"]').click();
});

When('I sort by {word}', async function (this: PlaywrightWorld, column: string) {
  const before = new URL(this.page.url()).search;
  await this.page.locator(COLUMN_HEADERS[column]).click();
  // Angular re-routes client-side, so wait for the query string to actually carry the new sort
  await expect.poll(() => new URL(this.page.url()).search, {timeout: 10_000}).not.toEqual(before);
});

When(
  'I open the owners page at page {int} of size {int} sorted by {word} {word}',
  async function (this: PlaywrightWorld, page: number, size: number, sort: string, dir: string) {
    const direction = dir === 'descending' ? 'DESC' : 'ASC';
    await this.page.goto(`/owners?page=${page}&size=${size}&sort=${sort}&dir=${direction}`);
    await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
  },
);

Then('the grid shows {int} owners', async function (this: PlaywrightWorld, size: number) {
  await expect.poll(() => namesOnScreen(this).then((n) => n.length), {timeout: 10_000})
    .toEqual(size);
});

Then('none of them appeared on the previous page', async function (this: PlaywrightWorld) {
  const current = await namesOnScreen(this);
  const previous = this.previousPageNames ?? [];
  expect(current.filter((name) => previous.includes(name))).toEqual([]);
});

Then('the grid is back on the first page of owners', async function (this: PlaywrightWorld) {
  await expect.poll(() => namesOnScreen(this), {timeout: 10_000})
    .toEqual(this.previousPageNames ?? []);
});

/** True when the column's values on screen are in `direction` order under English collation. */
async function isSortedBy(
  world: PlaywrightWorld,
  column: string,
  direction: 'asc' | 'desc',
): Promise<boolean> {
  const values = await valuesOf(world, column);
  const sign = direction === 'asc' ? 1 : -1;
  return values.every((v, i) => i === 0 || sign * values[i - 1].localeCompare(v, 'en') <= 0);
}

Then('the owners are sorted by {word}', async function (this: PlaywrightWorld, column: string) {
  await expect.poll(() => isSortedBy(this, column, 'asc'), {timeout: 10_000}).toBe(true);
});

Then('the owners are sorted by {word} in reverse', async function (
  this: PlaywrightWorld,
  column: string,
) {
  await expect.poll(() => isSortedBy(this, column, 'desc'), {timeout: 10_000}).toBe(true);
});

Then('the paginator reports page {int}', async function (this: PlaywrightWorld, page: number) {
  const size = Number(new URL(this.page.url()).searchParams.get('size'));
  const firstRow = (page - 1) * size + 1;
  await expect(this.page.locator('#ownersPaginator')).toContainText(`${firstRow} –`);
});
