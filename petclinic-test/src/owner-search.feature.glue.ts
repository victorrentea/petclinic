import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

// As the grid shows a name: surname first. Names hold a comma, so an Examples cell separates them with ';'.
const fullName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected`, in that order (an empty list: no table). */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);

  await expect.poll(listed, {timeout: 10_000}).toEqual(expected);
}

/**
 * Checks the owners the Background names exist — so a changed seed (Flyway's
 * db/seed/R__seed.sql) fails on the Given instead of looking like a broken search —
 * and remembers the first page of all owners, as the API orders it.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  for (const [name] of owners.raw()) {
    const [lastName] = name.split(',');
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {lastName, size: 100}, timeout: 10_000});
    expect(data.content.map(fullName), 'is the backend up and the DB seeded by Flyway?').toContain(name.trim());
  }
  const {data: firstPage} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  this.firstPageOfOwners = firstPage.content.map(fullName);
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  // The grid searches as you type, once typing pauses: no button to press.
  await this.page.locator('#lastName').fill(search);
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

Then('the first page of all owners is listed, by name', async function (this: PlaywrightWorld) {
  await expectOwnersListed(this, this.requireFirstPageOfOwners());
});
