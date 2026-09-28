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

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
async function expectOwnersListed(world: PlaywrightWorld, expected: string[]): Promise<void> {
  const cells = world.page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}

/**
 * Checks that the owners the Background names exist, one last-name search each — so a
 * changed seed (Flyway's db/seed/R__seed.sql) fails on the Given instead of looking like a
 * broken search. The list is paginated, so it is never fetched whole.
 */
Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  for (const [name] of owners.raw()) {
    const lastName = name.trim().split(' ').pop()!;
    const {data} = await axios.get(`${API_BASE}/owners`, {params: {lastName, size: 20}, timeout: 10_000});
    expect(data.content.map(fullName), `the API knows no owner "${name.trim()}"`).toContain(name.trim());
  }
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

/** Polls both sides: other suites add owners to the same DB while this runs. */
Then('the owners list counts every owner in the clinic', async function (this: PlaywrightWorld) {
  const range = this.page.locator('mat-paginator .mat-mdc-paginator-range-label');
  const shownTotal = async () => Number((await range.textContent())?.match(/of\s+(\d+)/)?.[1]);
  const apiTotal = async () => (await axios.get(`${API_BASE}/owners`, {timeout: 10_000})).data.totalElements;

  await expect.poll(async () => (await shownTotal()) === (await apiTotal()), {timeout: 10_000}).toBe(true);
});
