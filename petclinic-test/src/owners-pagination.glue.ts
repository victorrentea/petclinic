import {DataTable, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {
  collectEveryPage, currentPage, goToPage, headerCell, listedOwners, nameCells,
  sortArrowFor, sortBy, sortKeyFor, totalElements,
} from './support/owners-grid';

// The paging half of the owners grid. The Given/When steps that merely open the page,
// state the seeded owners or run a search are shared with owner-search.glue.ts.

const rowsOf = (table: DataTable) => table.raw().map(([cell]) => cell.trim()).filter(Boolean);

const duplicatesIn = (names: string[]) =>
  [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];

async function expectAtMost(world: PlaywrightWorld, count: number): Promise<void> {
  await expect.poll(async () => {
    const listed = await nameCells(world.page).count();
    return listed > 0 && listed <= count;
  }, {timeout: 10_000}).toBe(true);
  expect(await nameCells(world.page).count()).toBeLessThanOrEqual(count);
}

When('I set the page size to {int}', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('#ownersPager select#pageSizeSelect').selectOption(String(size));
  await expectAtMost(this, size);
});

When('I sort owners by {string} {word}', async function (this: PlaywrightWorld, column: string, direction: string) {
  await sortBy(this.page, column, direction);
});

When('I go to page {int}', async function (this: PlaywrightWorld, page: number) {
  await goToPage(this.page, page);
});

When('I walk from the first page to the last page', async function (this: PlaywrightWorld) {
  await goToPage(this.page, 1);
  this.collectedOwnerNames = await collectEveryPage(this.page);
});

When('I open the owner {string}', async function (this: PlaywrightWorld, name: string) {
  await this.page.locator('#ownersTable td.ownerFullName a').filter({hasText: name}).first().click();
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
});

When('I go back', async function (this: PlaywrightWorld) {
  await this.page.goBack();
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

Then('at most {int} owners are listed', async function (this: PlaywrightWorld, count: number) {
  await expectAtMost(this, count);
});

Then('the pager reports every owner in the clinic in total', async function (this: PlaywrightWorld) {
  const expected = this.requireAllOwnerNames().length;
  await expect.poll(() => totalElements(this.page), {timeout: 10_000}).toBe(expected);
});

Then('the pager reports page {int}', async function (this: PlaywrightWorld, page: number) {
  await expect.poll(() => currentPage(this.page), {timeout: 10_000}).toBe(page);
});

/** The data table is the head of the listing: it names the first rows, in order. */
Then('the owners are listed in this order', async function (this: PlaywrightWorld, owners: DataTable) {
  const expected = rowsOf(owners);
  await expect.poll(async () => (await listedOwners(this.page)).slice(0, expected.length),
    {timeout: 10_000}).toEqual(expected);
});

Then('the owners list contains {string}', async function (this: PlaywrightWorld, name: string) {
  await expect.poll(() => listedOwners(this.page), {timeout: 10_000}).toContain(name);
});

Then('the owners list does not contain {string}', async function (this: PlaywrightWorld, name: string) {
  await expect.poll(() => listedOwners(this.page), {timeout: 10_000}).not.toContain(name);
});

Then('every owner in the clinic was listed exactly once', function (this: PlaywrightWorld) {
  const collected = this.requireCollectedOwnerNames();
  expect(duplicatesIn(collected), 'owners seen on more than one page').toEqual([]);
  expect([...collected].sort()).toEqual([...this.requireAllOwnerNames()].sort());
});

Then('paging to the last page lists every owner in the clinic', async function (this: PlaywrightWorld) {
  const collected = await collectEveryPage(this.page);
  expect(duplicatesIn(collected), 'owners seen on more than one page').toEqual([]);
  expect([...collected].sort()).toEqual([...this.requireAllOwnerNames()].sort());
});

Then('the owners are still sorted by {string} {word}', async function (this: PlaywrightWorld, column: string, direction: string) {
  const arrow = this.page.locator(`#ownersTable th.sortable[data-sort-key="${sortKeyFor(column)}"] span.sort-arrow`);
  await expect(arrow).toHaveText(sortArrowFor(direction), {timeout: 10_000});
  // The dimmed arrow on an unsorted column is the same glyph as the ascending one, so the
  // text alone would let an unsorted column pass as "sorted ascending".
  await expect(arrow).not.toHaveClass(/sort-arrow-idle/, {timeout: 10_000});
});

Then('these columns offer a sort control', async function (this: PlaywrightWorld, columns: DataTable) {
  for (const column of rowsOf(columns)) {
    const header = headerCell(this.page, column);
    await expect(header, `the ${column} header should be sortable`).toHaveClass(/\bsortable\b/);
    await expect(header.locator('span.sort-arrow')).toHaveCount(1);
  }
});

Then('these columns offer no sort control', async function (this: PlaywrightWorld, columns: DataTable) {
  for (const column of rowsOf(columns)) {
    const header = headerCell(this.page, column);
    await expect(header, `the ${column} header should not be sortable`).not.toHaveClass(/\bsortable\b/);
    await expect(header.locator('span.sort-arrow')).toHaveCount(0);
  }
});
