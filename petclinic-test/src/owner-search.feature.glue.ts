import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {countAllOwners, defaultFirstPageNames, ensureOwnerExists, OwnerRow} from './support/owner-api';
import {OwnersPage, SortableColumn} from './pages/OwnersPage';

// Gherkin, bound directly: the steps do the work themselves, with no DSL layer
// underneath — the .feature is the readable artefact here, and a second naming
// of the same sentences would only add indirection. (add-visit.spec.ts makes the
// opposite case: no Gherkin, sentences as a DSL in add-visit.dsl.ts.)
//
// Nothing below decides anything: the Background states the data, each scenario
// the expected grid. Selectors live in pages/OwnersPage.ts.

const SETTLE = {timeout: 10_000};

const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);
const ownersPage = (world: PlaywrightWorld) => new OwnersPage(world.page);

Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  for (const owner of owners.hashes() as unknown as OwnerRow[]) {
    await ensureOwnerExists(owner);
  }
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await ownersPage(this).open();
});

When('I open the link {string}', async function (this: PlaywrightWorld, link: string) {
  await ownersPage(this).open(link);
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await ownersPage(this).search(search);
});

When(/^I sort by "(Name|City)"(?: again)?$/, async function (this: PlaywrightWorld, column: SortableColumn) {
  await ownersPage(this).sortBy(column);
});

When('I go to the next page', async function (this: PlaywrightWorld) {
  await ownersPage(this).nextPage();
});

When('I show {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await ownersPage(this).showPerPage(size);
});

When('I press the browser\'s Back button', async function (this: PlaywrightWorld) {
  await this.page.goBack();
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  const listedNames = async () => (await ownersPage(this).listedOwners()).map((o) => o.name).sort();
  await expect.poll(listedNames, SETTLE).toEqual(namesIn(owners).sort());
});

Then('these owners are listed, in order:', async function (this: PlaywrightWorld, owners: DataTable) {
  await expect.poll(() => ownersPage(this).listedOwners(), SETTLE).toEqual(owners.hashes());
});

Then('the first {int} owners by name are listed', async function (this: PlaywrightWorld, count: number) {
  const expected = await defaultFirstPageNames();
  expect(expected).toHaveLength(count);
  const listedNames = async () => (await ownersPage(this).listedOwners()).map((o) => o.name);
  await expect.poll(listedNames, SETTLE).toEqual(expected);
});

Then('the cities listed are {string}', async function (this: PlaywrightWorld, cities: string) {
  const listedCities = async () => (await ownersPage(this).listedOwners()).map((o) => o.city);
  await expect.poll(listedCities, SETTLE).toEqual(namesIn(cities));
});

Then('the paginator shows {string}', async function (this: PlaywrightWorld, range: string) {
  await expect.poll(() => ownersPage(this).range(), SETTLE).toBe(range);
});

Then('the paginator shows owners {int} – {int} of every owner in the clinic',
  async function (this: PlaywrightWorld, first: number, last: number) {
    const total = await countAllOwners();
    await expect.poll(() => ownersPage(this).range(), SETTLE).toBe(`${first} – ${last} of ${total}`);
  });

Then('the address holds {string}', async function (this: PlaywrightWorld, param: string) {
  const [name, value] = param.split('=');
  await expect.poll(() => ownersPage(this).queryParam(name), SETTLE).toBe(value);
});

Then('the search box shows {string}', async function (this: PlaywrightWorld, lastName: string) {
  await expect(ownersPage(this).searchBox).toHaveValue(lastName, SETTLE);
});

Then('the message {string} is shown', async function (this: PlaywrightWorld, message: string) {
  await expect(ownersPage(this).noOwnersMessage).toHaveText(message, SETTLE);
});

Then('neither the table nor the paginator is shown', async function (this: PlaywrightWorld) {
  const page = ownersPage(this);
  await expect(page.table).toBeHidden();
  await expect(page.paginator).toBeHidden();
});
