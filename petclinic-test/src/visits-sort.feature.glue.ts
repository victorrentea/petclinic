import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';

// Gherkin bound directly, like owner-search.feature.glue.ts: the steps do the work.

const CELL_OF_COLUMN: Record<string, string> = {
  Date: 'td.visit-date',
  Description: 'td.visit-description',
  Pet: 'td.visit-pet',
  Owner: 'td.visit-owner',
};
const CLICKS: Record<string, number> = {once: 1, twice: 2};

// Close to how Postgres orders text under en_US: case, accents and spaces only break ties.
const collator = new Intl.Collator('en', {sensitivity: 'base', ignorePunctuation: true});

function cellsOf(world: PlaywrightWorld, column: string) {
  const cell = CELL_OF_COLUMN[column];
  if (!cell) throw new Error(`No column "${column}" in the visits grid`);
  return world.page.locator(`#visitsTable tbody ${cell}`);
}

When('I open the visits grid', async function (this: PlaywrightWorld) {
  await this.page.goto('/visits');
  await this.page.locator('#visitsTable tbody tr').first().waitFor({state: 'visible', timeout: 10_000});
});

// Each click waits for the page it asked for: the default grid is already newest first,
// so "Date, twice" would pass on the untouched grid if the clicks were not awaited.
When('I click the {string} header {word}', async function (this: PlaywrightWorld, column: string, times: string) {
  const header = this.page.locator('#visitsTable th', {hasText: column});
  for (let i = 0; i < CLICKS[times]; i++) {
    await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/api/visits?') && r.url().includes('sort=')),
      header.click(),
    ]);
  }
});

Then('the {string} values on the first page are in {word} order',
  async function (this: PlaywrightWorld, column: string, order: string) {
    const sign = order === 'ascending' ? 1 : -1;
    const values = async () => (await cellsOf(this, column).allTextContents())
      .map((t) => t.trim().replace(/\s+/g, ' '));
    const isSorted = (v: string[]) => v.every((s, i) => i === 0 || sign * collator.compare(v[i - 1], s) <= 0);

    await expect.poll(async () => isSorted(await values()), {timeout: 10_000}).toBe(true);
    const shown = await values();
    expect(shown.length, 'a first page of 10').toBe(10);
    expect(new Set(shown).size, 'distinct values, or the order proves nothing').toBeGreaterThan(1);
  });
