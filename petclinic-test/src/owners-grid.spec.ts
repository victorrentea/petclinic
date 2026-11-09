import {test, expect, Page} from './support/trace-fixture';
import axios from 'axios';

// #25: the Owners grid pages and sorts on the server, and the URL is its only state.
// Every expectation reads the API for the same query, so it holds on any dataset that has
// at least two pages of owners.
test.use({dbFixture: 'default'});

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const namesListed = (page: Page) => page.locator('#ownersTable td.ownerFullName');
const paginator = (page: Page) => page.locator('mat-paginator');

async function namesFromApi(query: string): Promise<string[]> {
  const {data} = await axios.get(`${API_BASE}/owners?${query}`, {timeout: 10_000});
  return data.content.map((o: any) => `${o.firstName} ${o.lastName}`);
}

async function expectListed(page: Page, query: string): Promise<void> {
  await expect(namesListed(page)).toHaveText(await namesFromApi(query));
}

async function openOwners(page: Page, query = ''): Promise<void> {
  await page.goto(`/owners${query}`);
  await page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
}

test('shows the first ten owners by name, and moves to the next page', async ({page}) => {
  await openOwners(page);
  await expectListed(page, 'page=0&size=10&sort=name,asc');

  await paginator(page).getByRole('button', {name: 'Next page'}).click();

  await expect(page).toHaveURL(/[?&]page=1(&|$)/);
  await expectListed(page, 'page=1&size=10&sort=name,asc');
});

test('changing the page size goes back to the first page', async ({page}) => {
  await openOwners(page, '?page=1');

  await paginator(page).locator('mat-select').click();
  await page.getByRole('option', {name: '5', exact: true}).click();

  await expect(namesListed(page)).toHaveCount(5);
  await expectListed(page, 'page=0&size=5&sort=name,asc');
});

test('sorts by City, then reverses on a second click', async ({page}) => {
  await openOwners(page);
  const city = page.locator('#ownersTable th').filter({hasText: 'City'});

  await city.locator('.mat-sort-header-container').click();
  await expect(page).toHaveURL(/sort=city(,|%2C)asc/);
  await expectListed(page, 'page=0&size=10&sort=city,asc');

  await city.locator('.mat-sort-header-container').click();
  await expect(page).toHaveURL(/sort=city(,|%2C)desc/);
  await expectListed(page, 'page=0&size=10&sort=city,desc');
});

test('sortable columns show their arrow without hover: white when active, grey otherwise', async ({page}) => {
  await openOwners(page);
  const arrow = (column: string) => page.locator('#ownersTable th').filter({hasText: column})
    .locator('.mat-sort-header-arrow');

  await expect(arrow('Name')).toHaveCSS('opacity', '1');
  await expect(arrow('Name')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(arrow('City')).toHaveCSS('opacity', '1');
  await expect(arrow('City')).toHaveCSS('color', 'rgb(158, 158, 158)');
  await expect(arrow('Telephone')).toHaveCount(0);
});

test('an owner with several pets has the other cells centered vertically', async ({page}) => {
  await openOwners(page);

  await expect(namesListed(page).first()).toHaveCSS('vertical-align', 'middle');
});

test('each pet shows an emoji of its type before its name', async ({page}) => {
  await openOwners(page, '?lastName=McCallister');

  await expect(page.locator('#ownersTable').getByRole('img', {name: 'hamster'})).toHaveText('🐹');
  await expect(page.locator('#ownersTable')).toContainText('🐹 Axel');
});

test('columns stay in place when the sort brings other owners on screen', async ({page}) => {
  const columnEdges = () => page.locator('#ownersTable th').evaluateAll(
    headers => headers.map(th => Math.round(th.getBoundingClientRect().left)));
  await openOwners(page, '?size=5&sort=name,asc');
  await expectListed(page, 'page=0&size=5&sort=name,asc');
  const edges = await columnEdges();

  for (const sort of ['name,desc', 'city,asc', 'city,desc']) {
    await openOwners(page, `?size=5&sort=${sort}`);
    await expectListed(page, `page=0&size=5&sort=${sort}`);
    expect(await columnEdges(), `columns under sort=${sort}`).toEqual(edges);
  }
});

for (const column of ['Address', 'Telephone', 'Pets']) {
  test(`${column} is not sortable`, async ({page}) => {
    await openOwners(page);
    await page.locator('#ownersTable th').filter({hasText: column}).click();

    await expect(page.locator('#ownersTable th').filter({hasText: column}).locator('.mat-sort-header-container'))
      .toHaveCount(0);
    await expectListed(page, 'page=0&size=10&sort=name,asc');
  });
}

test('Back from an owner returns to the same page and order', async ({page}) => {
  const query = 'page=1&size=5&sort=city,desc';
  await openOwners(page, `?${query}`);
  await expectListed(page, query);

  await namesListed(page).first().locator('a').click();
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await page.goBack();

  await expectListed(page, query);
});

test('a page past the end moves to the last page', async ({page}) => {
  const {data} = await axios.get(`${API_BASE}/owners?size=20`, {timeout: 10_000});
  await openOwners(page, '?page=99&size=20');

  await expectListed(page, `page=${data.totalPages - 1}&size=20&sort=name,asc`);
});

test('a search from a later page shows its first page', async ({page}) => {
  await openOwners(page, '?page=1');

  await page.fill('#lastName', 'potter');
  await page.locator('button:has-text("Find Owner")').click();

  await expect(page).toHaveURL(/lastName=potter/);
  await expect(page).not.toHaveURL(/[?&]page=[1-9]/);
  await expectListed(page, 'lastName=potter&page=0&size=10&sort=name,asc');
});

test('a search with no match says so and keeps Add Owner', async ({page}) => {
  await openOwners(page, '?lastName=Zzzz');

  await expect(page.getByText('No owners with LastName starting with "Zzzz"')).toBeVisible();
  await expect(page.locator('button:has-text("Add Owner")')).toBeVisible();
});
