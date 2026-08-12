import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {PlaywrightWorld} from '../support/world';
import {
  expectClinicOwnersAre,
  expectOwnersListed,
  openOwnersPage,
  searchOwnersByLastName,
} from '../dsl/owner-search.dsl';

// One-line adapters over the glue functions in ../dsl. The Background states the
// data and the Examples table states the search term and the expected result
// set, so no step here decides anything — the .feature does.

const namesIn = (cell: string) => cell.split(',').map((n) => n.trim()).filter(Boolean);

Given('the clinic has exactly these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  this.allOwnerNames = owners.raw().map(([name]) => name.trim());
  await expectClinicOwnersAre(this.allOwnerNames);
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
