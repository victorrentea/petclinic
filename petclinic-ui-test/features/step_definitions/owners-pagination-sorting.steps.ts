import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from '../support/world';
import {OwnersPage} from '../../tests/pages/OwnersPage';
import {ApiClient, OwnerPageQuery} from '../../tests/support/api-client';

const api = new ApiClient();

async function expectedNamesLastFirst(query: OwnerPageQuery): Promise<string[]> {
  const page = await api.fetchOwnerPage(query);
  return ApiClient.getFullNamesLastFirst(page.content);
}

Given('there are more owners than fit on one page', async function (this: PlaywrightWorld) {
  const page = await api.fetchOwnerPage({page: 0, size: 10, sort: 'name,asc'});
  if (page.totalElements <= 10) {
    throw new Error(`Need more than 10 owners to paginate; found ${page.totalElements}`);
  }
  this.ownersTotal = page.totalElements;
});

Given('I am on the Owners screen showing the first page of 10 owners', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  await owners.goToUrl('page=0&size=10&sort=name,asc');
  await expect(owners.ownerNameCells.first()).toBeVisible({timeout: 10_000});
});

Given('I am on the Owners screen', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  await owners.open();
  await expect(owners.ownerNameCells.first()).toBeVisible({timeout: 10_000});
});

Given('the owners are sorted by last name ascending by default', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  const expected = await expectedNamesLastFirst({page: 0, size: 10, sort: 'name,asc'});
  await expect.poll(() => owners.getOwnerFullNames()).toEqual(expected);
});

Given('each Name cell shows the last name first, e.g. {string}', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  const names = await owners.getOwnerFullNames();
  expect(names.length).toBeGreaterThan(0);
  // Each Name cell is "LastName FirstName"; correctness is asserted against the API (last-first) above.
  expect(names[0]).toContain(' ');
});

When('I click {string}', async function (this: PlaywrightWorld, control: string) {
  const owners = new OwnersPage(this.page);
  if (control === 'next page') {
    await owners.clickNext();
  } else if (control === 'previous page') {
    await owners.clickPrev();
  } else {
    throw new Error(`Unknown pagination control "${control}"`);
  }
});

When('I click the {string} column header', async function (this: PlaywrightWorld, column: string) {
  const owners = new OwnersPage(this.page);
  if (column === 'Name') {
    await owners.clickSortByName();
  } else if (column === 'City') {
    await owners.clickSortByCity();
  } else {
    throw new Error(`Column "${column}" is not sortable`);
  }
});

When('I click the {string} column header again', async function (this: PlaywrightWorld, column: string) {
  const owners = new OwnersPage(this.page);
  if (column === 'Name') {
    await owners.clickSortByName();
  } else if (column === 'City') {
    await owners.clickSortByCity();
  } else {
    throw new Error(`Column "${column}" is not sortable`);
  }
});

Then('the second page of owners is shown', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  const expected = await expectedNamesLastFirst({page: 1, size: 10, sort: 'name,asc'});
  await expect.poll(() => owners.getOwnerFullNames()).toEqual(expected);
});

Then('the first page of owners is shown again', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  const expected = await expectedNamesLastFirst({page: 0, size: 10, sort: 'name,asc'});
  await expect.poll(() => owners.getOwnerFullNames()).toEqual(expected);
});

Then('the range label reads {string}', async function (this: PlaywrightWorld, label: string) {
  const owners = new OwnersPage(this.page);
  const expected = label.replace('<total>', String(this.ownersTotal));
  await expect.poll(() => owners.getRangeLabel()).toBe(expected);
});

Then('the owners are sorted by last name descending', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  const expected = await expectedNamesLastFirst({page: 0, size: 10, sort: 'name,desc'});
  await expect.poll(() => owners.getOwnerFullNames()).toEqual(expected);
});

Then('the owners are sorted by last name ascending', async function (this: PlaywrightWorld) {
  const owners = new OwnersPage(this.page);
  const expected = await expectedNamesLastFirst({page: 0, size: 10, sort: 'name,asc'});
  await expect.poll(() => owners.getOwnerFullNames()).toEqual(expected);
});
