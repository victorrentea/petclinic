import {When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';

// Gherkin bound directly, like owner-search.feature.glue.ts: the Examples table says which
// header is clicked how often, and in which order its column must then read.

const CELL_OF_COLUMN: Record<string, string> = {
  Date: 'td.visit-date',
  Description: 'td.visit-description',
  Pet: 'td.visit-pet',
  Owner: 'td.visit-owner',
};
const CLICKS: Record<string, number> = {once: 1, twice: 2};

When('I open the visits grid', async function (this: PlaywrightWorld) {
  await this.page.goto('/visits');
  await this.page.locator('#visitsTable tbody tr').first().waitFor({state: 'visible', timeout: 10_000});
});

// Each click re-queries the backend; waiting for that answer is what keeps the Then from
// reading the page the previous sort left on screen.
When('I click the {string} header {word}', async function (this: PlaywrightWorld, column: string, clicks: string) {
  const header = this.page.locator('#visitsTable th', {hasText: column});
  for (let i = 0; i < CLICKS[clicks]; i++) {
    const served = this.page.waitForResponse(
      (r) => r.url().includes('/api/visits?') && r.request().method() === 'GET');
    await header.click();
    await served;
  }
});

// Plain code-point order: the database collates C.UTF-8, which is what Array.sort() does,
// so "Ștefan" sorts after "Wendy" on both sides.
Then('the {string} values on the first page are in {word} order',
  async function (this: PlaywrightWorld, column: string, direction: string) {
    const cells = this.page.locator(`#visitsTable tbody ${CELL_OF_COLUMN[column]}`);
    const values = async () => (await cells.allTextContents()).map((t) => t.trim().replace(/\s+/g, ' '));
    const inOrder = (v: string[]) => (direction === 'ascending' ? [...v].sort() : [...v].sort().reverse());

    // Polled, as Angular renders a beat after the response; a failure prints what was shown.
    const verdict = async () => {
      const shown = await values();
      const ordered = shown.length === 10 && shown.join('\n') === inOrder(shown).join('\n');
      return ordered ? 'a full first page, in order' : shown.join(' | ');
    };
    await expect.poll(verdict, {timeout: 10_000}).toBe('a full first page, in order');
  });
