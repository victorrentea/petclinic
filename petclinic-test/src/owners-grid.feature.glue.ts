import {When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';

// New steps for owners-grid.feature. "I open the owners page", "I search owners
// for", "exactly these owners are listed" and "every owner in the clinic is
// listed" are shared with owner-search.feature.glue.ts — Cucumber loads every
// *.glue.ts into one step registry, so redefining them here would collide.

const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

async function waitForOwnersResponse(world: PlaywrightWorld, action: () => Promise<void>): Promise<void> {
  await Promise.all([
    world.page.waitForResponse((r) => r.url().includes('/api/owners') && r.request().method() === 'GET'),
    action(),
  ]);
}

When('I sort owners by {string} {word}', async function (this: PlaywrightWorld, column: string, direction: string) {
  const header = this.page.locator(`th:has-text("${column}")`);
  for (let attempts = 0; attempts < 3; attempts++) {
    if ((await header.getAttribute('aria-sort')) === direction) {
      return;
    }
    await waitForOwnersResponse(this, () => header.click());
  }
  throw new Error(`Could not reach sort "${column}" ${direction}`);
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('.mat-mdc-paginator-page-size-select').click();
  await waitForOwnersResponse(this, () => this.page.locator(`mat-option:has-text("${size}")`).click());
});

/** "page" is 1-based, as a clinic user reads it off the paginator. */
When('I go to page {int}', async function (this: PlaywrightWorld, page: number) {
  const nextButton = this.page.locator('.mat-mdc-paginator-navigation-next');
  for (let i = 1; i < page; i++) {
    await waitForOwnersResponse(this, () => nextButton.click());
  }
});

When('I open the owners page at {string}', async function (this: PlaywrightWorld, query: string) {
  await this.page.goto(`/owners?${query}`);
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

Then('the owners are listed in this order: {string}', async function (this: PlaywrightWorld, owners: string) {
  const expected = namesIn(owners);
  const cells = this.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim());

  await expect.poll(listed, {timeout: 10_000}).toEqual(expected);
});
