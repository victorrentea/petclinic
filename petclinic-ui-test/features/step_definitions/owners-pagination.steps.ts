import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from '../support/world';
import {OwnersPage} from '../../tests/pages/OwnersPage';
import {ApiClient, DEFAULT_PAGE_SIZE, DEFAULT_SORT} from '../../tests/support/api-client';

const api = new ApiClient();

/** Rows the server puts on page `index` of a `size`-row paging of `total` owners. */
const rowsOnPage = (total: number, size: number, index: number) =>
  Math.max(0, Math.min(size, total - index * size));

Given('at least {int} owners exist', async function (this: PlaywrightWorld, minimum: number) {
  const firstPage = await api.fetchOwnerPage({page: 0, size: DEFAULT_PAGE_SIZE, sort: DEFAULT_SORT});
  if (firstPage.totalElements < minimum) {
    throw new Error(
      `Only ${firstPage.totalElements} owners exist; the pagination scenarios need at least ${minimum}`,
    );
  }
  this.totalOwners = firstPage.totalElements;
  this.totalOwnerPages = firstPage.totalPages;
});

Then('the grid shows at most {int} owners', async function (this: PlaywrightWorld, maximum: number) {
  const ownersPage = new OwnersPage(this.page);
  await ownersPage.waitForOwnersCount(Math.min(maximum, this.totalOwners!));
  const shown = await ownersPage.getOwnerFullNames();

  expect(shown.length).toBeGreaterThan(0);
  expect(shown.length).toBeLessThanOrEqual(maximum);
  // Nothing was quietly shipped to the browser and hidden: the grid holds one page only.
  expect(shown.length).toBeLessThan(this.totalOwners!);
});

Then('the pager reports more than one page', async function (this: PlaywrightWorld) {
  const ownersPage = new OwnersPage(this.page);
  expect(await ownersPage.getTotalPagesFromPager()).toBe(this.totalOwnerPages);
  expect(this.totalOwnerPages).toBeGreaterThan(1);
});

When('I page through every page of the grid', async function (this: PlaywrightWorld) {
  const ownersPage = new OwnersPage(this.page);
  const total = this.totalOwners!;
  const totalPages = this.totalOwnerPages!;
  const ownerIdsSeen: number[] = [];

  for (let index = 0; index < totalPages; index++) {
    await ownersPage.waitForOwnersCount(rowsOnPage(total, DEFAULT_PAGE_SIZE, index));
    ownerIdsSeen.push(...(await ownersPage.getOwnerIds()));
    expect(ownersPage.readPageFromUrl()).toBe(index);

    if (index < totalPages - 1) {
      expect(await ownersPage.isNextPageEnabled()).toBe(true);
      await ownersPage.goToNextPage();
    }
  }

  // The last page is the last page: there is nowhere further to go.
  expect(await ownersPage.isNextPageEnabled()).toBe(false);
  this.ownerIdsSeenWhilePaging = ownerIdsSeen;
});

Then('every owner was listed exactly once', function (this: PlaywrightWorld) {
  const seen = this.ownerIdsSeenWhilePaging;
  if (!seen) {
    throw new Error('Expected the scenario to have paged through the grid first');
  }
  // No owner on two pages (unique) and none skipped (count matches the server total).
  expect([...new Set(seen)].length).toBe(seen.length);
  expect(seen.length).toBe(this.totalOwners);
});

When('I choose {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  const ownersPage = new OwnersPage(this.page);
  await ownersPage.waitForOwnersCount(rowsOnPage(this.totalOwners!, DEFAULT_PAGE_SIZE, 0));
  await ownersPage.selectPageSize(size);
});

Then('the grid shows {int} owners', async function (this: PlaywrightWorld, expected: number) {
  const ownersPage = new OwnersPage(this.page);
  await ownersPage.waitForOwnersCount(expected);
  expect((await ownersPage.getOwnerFullNames()).length).toBe(expected);
});

Then('the grid is back on the first page', function (this: PlaywrightWorld) {
  const ownersPage = new OwnersPage(this.page);
  expect(ownersPage.readPageFromUrl()).toBe(0);
});
