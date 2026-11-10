import {DataTable, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {OwnersPage} from './pages/OwnersPage';

// Bound straight to the Owners grid's page object, like owner-search.feature.glue.ts binds
// its sentences: the .feature carries every expected name, city and range label, so nothing
// here decides what the grid should show. Also used by owner-search.feature.

const POLL = {timeout: 10_000};

When('I open the owners page', async function (this: PlaywrightWorld) {
  await new OwnersPage(this.page).open();
});

When('I open the link {string}', async function (this: PlaywrightWorld, url: string) {
  await new OwnersPage(this.page).open(url);
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await new OwnersPage(this.page).showPerPage(size);
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await new OwnersPage(this.page).nextPage();
});

When('I sort the owners by {string}', async function (this: PlaywrightWorld, column: string) {
  await new OwnersPage(this.page).sortBy(column);
});

When('I open the details of {string}', async function (this: PlaywrightWorld, lastFirst: string) {
  await new OwnersPage(this.page).openOwner(lastFirst);
});

When('I go back', async function (this: PlaywrightWorld) {
  await this.page.goBack();
});

Then('the {string} column is sorted {word}', async function (
  this: PlaywrightWorld, column: string, direction: string,
) {
  await expect(new OwnersPage(this.page).columnHeader(column)).toHaveAttribute('aria-sort', direction, POLL);
});

/** In order, and only the columns the table's header row names. */
Then('the owners listed are:', async function (this: PlaywrightWorld, expected: DataTable) {
  const [columns, ...rows] = expected.raw();
  await expect.poll(() => new OwnersPage(this.page).rows(columns), POLL).toEqual(rows);
});

Then('{int} owners are listed, from {string} to {string}', async function (
  this: PlaywrightWorld, count: number, first: string, last: string,
) {
  const names = () => new OwnersPage(this.page).names();
  await expect.poll(async () => {
    const listed = await names();
    return {count: listed.length, first: listed[0], last: listed[listed.length - 1]};
  }, POLL).toEqual({count, first, last});
});

Then('the paginator reads {string}', async function (this: PlaywrightWorld, range: string) {
  const owners = new OwnersPage(this.page);
  await expect.poll(() => owners.range(), POLL).toBe(range);
});
