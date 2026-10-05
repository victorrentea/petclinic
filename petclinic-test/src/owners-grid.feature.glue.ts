import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';

// The grid's order is the database's (en_US collation); 'base' sensitivity compares
// the way it does for the letters these owners use: accents and case are secondary.
const collator = new Intl.Collator('en', {sensitivity: 'base'});
const inOrder = (values: string[]) => values.every((v, i) => i === 0 || collator.compare(values[i - 1], v) <= 0);

const rows = (world: PlaywrightWorld) => world.page.locator('#ownersTable tbody tr');
const rangeLabel = (world: PlaywrightWorld) => world.page.locator('.mat-mdc-paginator-range-label');

/** Acts, then waits for the page that action asked for: the paginator relabels before it arrives. */
async function andLoad(world: PlaywrightWorld, action: () => Promise<unknown>) {
  const answer = world.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/api/owners'));
  await action();
  await answer;
}

async function column(world: PlaywrightWorld, index: number): Promise<string[]> {
  return (await rows(world).locator(`td:nth-child(${index})`).allTextContents()).map((t) => t.trim());
}

const cities = (world: PlaywrightWorld) => column(world, 3);
const sortedColumn = {
  name: async (world: PlaywrightWorld) => (await column(world, 1)).map((name) => name.split(',')[0]),
  city: cities,
};

Then('{int} owners are listed, sorted by {word}',
  async function (this: PlaywrightWorld, count: number, by: 'name' | 'city') {
    await expect(rows(this)).toHaveCount(count);
    expect(inOrder(await sortedColumn[by](this))).toBe(true);
  });

When('I sort the owners by {string}', async function (this: PlaywrightWorld, header: string) {
  await andLoad(this, () => this.page.locator('#ownersTable th', {hasText: header}).click());
  await expect(this.page.locator('#ownersTable th[aria-sort="ascending"]')).toHaveText(header);
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.locator('mat-paginator mat-select').click();
  await andLoad(this, () => this.page.locator('mat-option', {hasText: String(size)}).click());
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  this.lastCityOnPage = (await cities(this)).at(-1);
  await andLoad(this, () => this.page.locator('button.mat-mdc-paginator-navigation-next').click());
});

When('I refresh the screen', async function (this: PlaywrightWorld) {
  await andLoad(this, () => this.page.reload());
});

Then('the paginator shows owners {int} to {int}', async function (this: PlaywrightWorld, from: number, to: number) {
  await expect(rangeLabel(this)).toHaveText(new RegExp(`^\\s*${from} – ${to} of \\d+\\s*$`));
});

Then('{int} owners are listed, sorted by city, following the previous page',
  async function (this: PlaywrightWorld, count: number) {
    await expect(rows(this)).toHaveCount(count);
    expect(inOrder([this.lastCityOnPage!, ...await cities(this)])).toBe(true);
  });
