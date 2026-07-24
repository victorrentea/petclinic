import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from '../support/world';
import {ApiClient, DEFAULT_PAGE_SIZE, DEFAULT_SORT} from '../../tests/support/api-client';

const api = new ApiClient();

Given('at least one owner exists', async function (this: PlaywrightWorld) {
  const firstPage = await api.fetchOwnerPage({page: 0, size: DEFAULT_PAGE_SIZE, sort: DEFAULT_SORT});
  const withLastName = firstPage.content.find((o) => typeof o.lastName === 'string' && o.lastName.length >= 2);
  if (!withLastName) {
    throw new Error('No owner with a usable last name found; cannot run owner-search scenario');
  }
  // "One name part": the first two letters of a real owner's last name.
  this.searchPrefix = withLastName.lastName.slice(0, 2);

  // The filtered list is paged as well, so the grid can only show the first page of matches.
  const matches = await api.fetchOwnerPage({
    lastName: this.searchPrefix,
    page: 0,
    size: DEFAULT_PAGE_SIZE,
    sort: DEFAULT_SORT,
  });
  const expected = ApiClient.getFullNames(matches.content).sort();
  if (expected.length === 0) {
    throw new Error(`API returned no owners for prefix "${this.searchPrefix}"; cannot assert data comes back`);
  }
  this.expectedFullNames = expected;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search for owners by a last name part', async function (this: PlaywrightWorld) {
  const prefix = this.searchPrefix;
  const expected = this.expectedFullNames;
  if (!prefix || !expected) {
    throw new Error('Expected a search prefix to have been chosen earlier in the scenario');
  }
  await this.page.locator('#lastName').fill(prefix);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
  // Wait until the filtered result set has settled to the expected size.
  await expect(this.page.locator('#ownersTable td.ownerFullName')).toHaveCount(expected.length, {timeout: 10_000});
});

Then('only owners whose last name starts with that part are listed', async function (this: PlaywrightWorld) {
  const prefix = this.searchPrefix!.toLowerCase();
  const cells = this.page.locator('#ownersTable td.ownerFullName');
  const shown = (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);

  expect(shown.length).toBeGreaterThan(0);
  for (const name of shown) {
    // Name cells read "Last, First", so the last name is everything before the comma.
    expect(ApiClient.extractLastName(name).toLowerCase()).toMatch(new RegExp(`^${prefix}`));
  }
  expect(shown.sort()).toEqual(this.expectedFullNames);
});
