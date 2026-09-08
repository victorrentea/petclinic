import {When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';

// Shares the Background/"I open the owners page"/"I search owners for" steps with
// owner-search.feature.glue.ts - only the paging-specific steps live here.

async function currentOwnerNames(world: PlaywrightWorld): Promise<string[]> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  return (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);
}

When('I go to the next page of owners', async function (this: PlaywrightWorld) {
  this.firstPageOwnerNames = await currentOwnerNames(this);
  await this.page.locator('#ownersPagination button:has-text("Next")').click();
});

Then('a different set of owners is shown than on the first page', async function (this: PlaywrightWorld) {
  if (!this.firstPageOwnerNames) {
    throw new Error('Expected the first page of owners to have been recorded before navigating away from it');
  }
  const firstPage = this.firstPageOwnerNames;
  await expect.poll(async () => currentOwnerNames(this), {timeout: 10_000})
    .not.toEqual(firstPage);
});

When('I set the owners page size to {int}', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('#pageSize').selectOption({label: String(size)});
});

Then('exactly {int} owners are listed', async function (this: PlaywrightWorld, expectedCount: number) {
  const cells = this.page.locator('#ownersTable td.ownerFullName');
  await expect.poll(async () => cells.count(), {timeout: 10_000}).toBe(expectedCount);
});
