import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {ApiClient, fullName} from './support/api-client';
import {PlaywrightWorld} from './support/world';

// The expected rows come from the API asked the same question, not from a list typed here:
// the scenarios hold on any dataset, and they check what the grid shows against what the
// server answers for the page the address names.

const api = new ApiClient();

async function expectPageListed(world: PlaywrightWorld, page: number, sort: string, size: number) {
  const owners = await api.fetchOwnerPage({page: page - 1, size, sort});
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim());

  await expect.poll(listed, {timeout: 10_000}).toEqual(owners.content.map(fullName));
}

async function lastPage(size: number): Promise<number> {
  return (await api.fetchOwnerPage({size})).totalPages;
}

When('I open the owners page at {string}', async function (this: PlaywrightWorld, query: string) {
  await this.page.goto('/owners' + query);
  await this.page.locator('#ownersTable').waitFor({state: 'visible', timeout: 10_000});
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await this.page.getByRole('button', {name: 'Next page'}).click();
});

When('I choose {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

When('I click the {string} header', async function (this: PlaywrightWorld, header: string) {
  await this.page.locator('#ownersTable th[mat-sort-header]', {hasText: header}).click();
});

When('I open the first owner listed', async function (this: PlaywrightWorld) {
  await this.page.locator('#ownersTable td.ownerFullName a').first().click();
  await this.page.waitForURL(/\/owners\/\d+$/);
});

When('I go back', async function (this: PlaywrightWorld) {
  await this.page.goBack();
});

Then('the address says page {int}', async function (this: PlaywrightWorld, page: number) {
  await expect(this.page).toHaveURL(new RegExp(`[?&]page=${page}(&|$)`));
});

Then('the address says the last page of {int} owners', async function (this: PlaywrightWorld, size: number) {
  await expect(this.page).toHaveURL(new RegExp(`[?&]page=${await lastPage(size)}(&|$)`));
});

Then('page {int} of the owners sorted {string}, {int} per page, is listed',
  async function (this: PlaywrightWorld, page: number, sort: string, size: number) {
    await expectPageListed(this, page, sort, size);
  });

Then('the last page of the owners sorted {string}, {int} per page, is listed',
  async function (this: PlaywrightWorld, sort: string, size: number) {
    await expectPageListed(this, await lastPage(size), sort, size);
  });
