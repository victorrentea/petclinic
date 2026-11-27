import {test, expect} from './support/trace-fixture';
import axios from 'axios';
import {OwnersPage} from './pages/OwnersPage';

// GH #25: the Owners grid shows one page at a time and sorts by Name or City only.
// Expectations come from the API itself, so the seed can change without touching this file.

test.use({dbFixture: 'default'});

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

async function ownersFromApi(query: string): Promise<string[]> {
  const {data} = await axios.get(`${API_BASE}/owners?${query}`, {timeout: 10_000});
  return data.content.map((o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`);
}

test('shows 10 owners by name, then 20 when asked', async ({page}) => {
  const owners = await OwnersPage.open(page);
  await expect.poll(() => owners.listedOwnerNames()).toEqual(await ownersFromApi('size=10&sort=name'));
  await expect(owners.rangeLabel).toHaveText(/1 – 10 of \d+/);

  await owners.showRowsPerPage(20);

  await expect.poll(() => owners.listedOwnerNames()).toEqual(await ownersFromApi('size=20&sort=name'));
  await expect(owners.rangeLabel).toHaveText(/1 – 20 of \d+/);
});

test('sorts by city A→Z, then Z→A; only Name and City can be sorted', async ({page}) => {
  const owners = await OwnersPage.open(page);
  expect(await owners.sortableColumns()).toEqual(['Name', 'City']);

  await owners.sortBy('City');
  await expect.poll(() => owners.listedOwnerNames()).toEqual(await ownersFromApi('sort=city,asc'));

  await owners.sortBy('City');
  await expect.poll(() => owners.listedOwnerNames()).toEqual(await ownersFromApi('sort=city,desc'));
});

test('Back from an owner returns to the same page and order', async ({page}) => {
  const owners = await OwnersPage.open(page);
  await owners.sortBy('City');
  await owners.nextPage();
  const secondPageByCity = await ownersFromApi('sort=city,asc&page=1');
  await expect.poll(() => owners.listedOwnerNames()).toEqual(secondPageByCity);

  await owners.openOwner(secondPageByCity[0]);
  await page.goBack();

  await expect.poll(() => owners.listedOwnerNames()).toEqual(secondPageByCity);
  await expect(page).toHaveURL(/page=1/);
});

test('a new search starts again from the first page', async ({page}) => {
  const owners = await OwnersPage.open(page);
  await owners.nextPage();
  await expect(page).toHaveURL(/page=1/);

  await owners.searchByLastName('Potter');

  await expect.poll(() => owners.listedOwnerNames()).toEqual(await ownersFromApi('lastName=Potter'));
  await expect(page).toHaveURL(/page=0/);
});
