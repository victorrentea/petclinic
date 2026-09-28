import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';

// Bound directly, like owner-search.feature.glue.ts. "I open the owners page" lives there.

const cities = (world: PlaywrightWorld) => world.page.locator('#ownersTable td.ownerCity');
const collator = new Intl.Collator('en');

function expectSorted(values: string[], descending: boolean): void {
  const sorted = [...values].sort(collator.compare);
  expect(values).toEqual(descending ? sorted.reverse() : sorted);
}

/**
 * Polls until the paginator reads "from – to of N", then until the table has its rows: the
 * label follows the URL at once, the rows only when the response lands (aria-busy="false").
 */
async function expectRows(world: PlaywrightWorld, from: number, to: number): Promise<string[]> {
  const range = world.page.locator('mat-paginator .mat-mdc-paginator-range-label');
  await expect(range).toHaveText(new RegExp(`^\\s*${from}\\s*[–-]\\s*${to}\\s+of\\s+\\d+`), {timeout: 10_000});
  await expect(world.page.locator('#ownersTable')).toHaveAttribute('aria-busy', 'false', {timeout: 10_000});
  await expect(cities(world)).toHaveCount(to - from + 1, {timeout: 10_000});
  return (await cities(world).allTextContents()).map((c) => c.trim());
}

When('I open the owners page at page {int}, {int} per page, sorted by {word} {word}',
  async function (this: PlaywrightWorld, page: number, size: number, column: string, direction: string) {
    const dir = direction === 'descending' ? 'desc' : 'asc';
    await this.page.goto(`/owners?page=${page - 1}&size=${size}&sort=${column.toLowerCase()}&dir=${dir}`);
    await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
  });

When('I sort the owners by {word}', async function (this: PlaywrightWorld, column: string) {
  await this.page.locator('#ownersTable th', {hasText: column}).click();
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await this.page.getByRole('option', {name: String(size), exact: true}).click();
});

When('I go to the next page of owners', async function (this: PlaywrightWorld) {
  this.previousPageCities = (await cities(this).allTextContents()).map((c) => c.trim());
  await this.page.getByRole('button', {name: 'Next page'}).click();
});

When('I go back in the browser', async function (this: PlaywrightWorld) {
  await this.page.goBack();
});

Then('owners {int} to {int} are listed', async function (this: PlaywrightWorld, from: number, to: number) {
  await expectRows(this, from, to);
});

Then('owners {int} to {int} are listed, in city order', async function (this: PlaywrightWorld, from: number, to: number) {
  expectSorted(await expectRows(this, from, to), false);
});

Then('owners {int} to {int} are listed, in reverse city order',
  async function (this: PlaywrightWorld, from: number, to: number) {
    expectSorted(await expectRows(this, from, to), true);
  });

Then('owners {int} to {int} are listed, in city order, after the previous page',
  async function (this: PlaywrightWorld, from: number, to: number) {
    const previous = this.previousPageCities ?? [];
    expectSorted([...previous, ...await expectRows(this, from, to)], false);
  });

Then('the owners are sorted by {word} {word}', async function (this: PlaywrightWorld, column: string, direction: string) {
  await expect(this.page.locator('#ownersTable th', {hasText: column})).toHaveAttribute('aria-sort', direction);
});
