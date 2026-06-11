import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from '../support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const NAME_CELL = 'table#ownersTable td.ownerFullName';
const RANGE_LABEL = '.mat-mdc-paginator-range-label';

async function fetchOwnersPage(params: Record<string, unknown>) {
  const {data} = await axios.get(`${API_BASE}/owners`, {params, timeout: 10_000});
  return data;
}

Given('more than 10 owners exist', async function (this: PlaywrightWorld) {
  const page = await fetchOwnersPage({page: 0, size: 1});
  this.expectedTotalOwners = page.page.totalElements;
  if ((this.expectedTotalOwners ?? 0) <= 10) {
    throw new Error(`Pagination needs > 10 owners, but found ${this.expectedTotalOwners}`);
  }
});

When('I open the owners list', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator(NAME_CELL).first().waitFor({state: 'visible', timeout: 10_000});
});

Then('at most 10 owner rows are shown', async function (this: PlaywrightWorld) {
  const count = await this.page.locator(NAME_CELL).count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(10);
});

Then('the paginator reports the total number of owners', async function (this: PlaywrightWorld) {
  const label = await this.page.locator(RANGE_LABEL).innerText();
  const reportedTotal = Number(label.match(/of\s+([\d,]+)/)?.[1]?.replace(/,/g, ''));
  expect(reportedTotal).toBe(this.expectedTotalOwners);
});

Then('the page size is 10', async function (this: PlaywrightWorld) {
  const label = await this.page.locator(RANGE_LABEL).innerText();
  const upperBound = Number(label.match(/[–-]\s*(\d+)/)?.[1]);
  expect(upperBound).toBe(10);
});

Then('I am on the first page', async function (this: PlaywrightWorld) {
  const label = await this.page.locator(RANGE_LABEL).innerText();
  expect(label.trim()).toMatch(/^1\s*[–-]/);
  await expect(this.page.locator('button.mat-mdc-paginator-navigation-previous')).toBeDisabled();
});

Then('the owner rows are sorted by name ascending', async function (this: PlaywrightWorld) {
  const data = await fetchOwnersPage({page: 0, size: 10, sort: 'name,asc'});
  const expected = data.content.map((o: {lastName: string; firstName: string}) => `${o.lastName}, ${o.firstName}`);
  const visible = (await this.page.locator(NAME_CELL).allInnerTexts()).map(text => text.trim());
  expect(visible).toEqual(expected);
});
