import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';
import {OwnersPage} from './pages/OwnersPage';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set. Names read "Last, First",
// as the grid shows them, so an Examples cell separates them with ";".

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const lastFirst = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

/**
 * Checks that the owners the Background names exist, so a changed seed (Flyway's
 * db/seed/R__seed.sql, which the feature asks for with @fixture:default) fails on
 * the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  for (const [name] of owners.raw()) {
    const lastName = name.split(',')[0].trim();
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {lastName, size: 20}, timeout: 10_000});
    const found: string[] = (data?.content ?? []).map(lastFirst);
    if (!found.includes(name.trim())) {
      throw new Error(`The API has no owner "${name}" (it answered ${JSON.stringify(found)}) — is the ` +
        'backend up, and was the DB reset to the @fixture:default this feature declares?');
    }
  }
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await new OwnersPage(this.page).search(search);
});

/** Polls until the grid has settled on exactly these owners — order-insensitive. */
Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  const listed = async () => (await new OwnersPage(this.page).names()).sort();
  await expect.poll(listed, {timeout: 10_000}).toEqual(namesIn(owners).sort());
});

Then('I am told no owner\'s last name starts with {string}', async function (this: PlaywrightWorld, search: string) {
  await expect(this.page.getByText(`No owners with LastName starting with "${search}"`))
    .toBeVisible({timeout: 10_000});
});
