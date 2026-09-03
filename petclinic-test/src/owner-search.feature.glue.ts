import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {allOwnerRows} from './owners-api';
import {PlaywrightWorld} from './support/world';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, the Examples
// table states the search term and the expected result set.



// The grid shows the family name first, so the assertions read the way the screen does.
const fullName = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;
// Semicolon, not comma: a name is now "Potter, Harry" and carries a comma of its own.
const namesIn = (cell: string) => cell.split(';').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Remembers every owner the clinic holds, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * V3__sample_data.sql) fails on the Given instead of looking like a broken search.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  // The endpoint is paged now, so walk every page rather than reading one array.
  const names: string[] = (await allOwnerRows()).map(fullName);
  if (names.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  expect(names).toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
  this.allOwnerNames = names;
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await this.page.goto('/owners');
  await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  await this.page.locator('#search-owner-form button[type="submit"]').click();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this, namesIn(owners));
});

/**
 * Under pagination "every owner" no longer fits one screen, so the assertion is over the first
 * page plus the total the grid reports: the page holds `size` of them, all real owners, and the
 * paginator's total matches what the API says the clinic holds.
 */
Then('the first page lists owners of the clinic, and the total matches', async function (
  this: PlaywrightWorld,
) {
  const all = this.requireAllOwnerNames();
  const cells = this.page.locator('#ownersTable td.ownerFullName');

  await expect.poll(async () => (await cells.count()), {timeout: 10_000}).toBeGreaterThan(0);

  const listed = (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);
  expect(listed.length).toBeLessThanOrEqual(all.length);
  expect(all).toEqual(expect.arrayContaining(listed));
  await expect(this.page.locator('#ownersPaginator')).toContainText(`of ${all.length}`);
});
