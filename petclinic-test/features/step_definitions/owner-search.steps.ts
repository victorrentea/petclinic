import {Given, When, Then} from '@cucumber/cucumber';
import {PlaywrightWorld} from '../support/world';
import {
  expectOwnersListed,
  fetchAllOwnerNames,
  openOwnersPage,
  searchOwnersByLastName,
} from '../dsl/owner-search.dsl';

// One-line adapters over the glue functions in ../dsl. The Examples table feeds
// them the search term and the expected result set, so no step here decides
// what to type — the .feature does.

const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

Given("the clinic's sample owners are loaded", async function (this: PlaywrightWorld) {
  this.allOwnerNames = await fetchAllOwnerNames();
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  await openOwnersPage(this.page);
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await searchOwnersByLastName(this.page, search);
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  await expectOwnersListed(this.page, namesIn(owners));
});

Then('every owner in the clinic is listed', async function (this: PlaywrightWorld) {
  await expectOwnersListed(this.page, this.requireAllOwnerNames());
});
