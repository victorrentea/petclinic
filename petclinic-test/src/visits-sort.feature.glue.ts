import {When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {VisitColumn, VisitsPage} from './pages/VisitsPage';

// Gherkin bound straight to the VisitsPage page object: the Examples table says which
// header is clicked how often, and in which order its column must then read.

const CLICKS: Record<string, number> = {once: 1, twice: 2};

When('I open the visits grid', async function (this: PlaywrightWorld) {
  await new VisitsPage(this.page).openGrid();
});

When('I click the {string} header {word}',
  async function (this: PlaywrightWorld, column: VisitColumn, clicks: string) {
    const visits = new VisitsPage(this.page);
    for (let i = 0; i < CLICKS[clicks]; i++) {
      await visits.clickHeader(column);
    }
  });

// Plain code-point order: the database collates C.UTF-8, which is what Array.sort() does,
// so "Ștefan" sorts after "Wendy" on both sides.
Then('the {string} values on the first page are in {word} order',
  async function (this: PlaywrightWorld, column: VisitColumn, direction: string) {
    const visits = new VisitsPage(this.page);
    const inOrder = (v: string[]) => (direction === 'ascending' ? [...v].sort() : [...v].sort().reverse());

    // Polled, as Angular renders a beat after the response; a failure prints what was shown.
    const verdict = async () => {
      const shown = await visits.columnValues(column);
      const ordered = shown.length === 10 && shown.join('\n') === inOrder(shown).join('\n');
      return ordered ? 'a full first page, in order' : shown.join(' | ');
    };
    await expect.poll(verdict, {timeout: 10_000}).toBe('a full first page, in order');
  });
