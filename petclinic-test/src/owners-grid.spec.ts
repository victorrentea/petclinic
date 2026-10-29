import {test, expect, Page} from './support/trace-fixture';
import axios from 'axios';

// Issue #25: the Owners grid pages (5/10/20 rows) and sorts by Name or City, on the server.
// Its own six owners, under a last name no one else has, so the search scopes the grid to
// exactly them whatever else the database holds — and they are deleted afterwards.
// Two of them are namesakes in the same city: paging must still show each one once.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const PREFIX = `Grid${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 8)}`;

// [last-name suffix, city]
const OWNERS: [string, string][] = [
  ['a', 'Zurich'], ['b', 'Arad'], ['c', 'Cluj'], ['c', 'Cluj'], ['d', 'Brasov'], ['e', 'Arad']];
const name = (suffix: string) => `${PREFIX}${suffix}, Ada`;

const createdIds: number[] = [];

test.beforeAll(async () => {
  for (const [suffix, city] of OWNERS) {
    const response = await axios.post(`${API_BASE}/owners`, {
      firstName: 'Ada', lastName: PREFIX + suffix, address: '1 Grid St', city, telephone: '6085551023'});
    createdIds.push(Number(response.headers.location.split('/').pop()));
  }
});

test.afterAll(async () => {
  for (const id of createdIds) {
    await axios.delete(`${API_BASE}/owners/${id}`);
  }
});

const cells = (page: Page) => page.locator('#ownersTable td.ownerFullName');
const rangeLabel = (page: Page) => page.locator('.mat-mdc-paginator-range-label');

async function namesOnThePage(page: Page): Promise<string[]> {
  return (await cells(page).allTextContents()).map((t) => t.trim());
}

/** Page 1 shows the first five of `expected`, and Next shows the sixth: each owner once. */
async function expectBothPages(page: Page, expected: string[]): Promise<void> {
  await expect(rangeLabel(page)).toHaveText('1 – 5 of 6');
  await expect.poll(() => namesOnThePage(page)).toEqual(expected.slice(0, 5));
  await page.locator('.mat-mdc-paginator-navigation-next').click();
  await expect(rangeLabel(page)).toHaveText('6 – 6 of 6');
  await expect.poll(() => namesOnThePage(page)).toEqual(expected.slice(5));
}

async function searchTheGridOwnersFiveAPage(page: Page): Promise<void> {
  await page.goto('/owners');
  await page.fill('#lastName', PREFIX);
  await page.locator('button:has-text("Find Owner")').click();
  await expect(rangeLabel(page)).toHaveText('1 – 6 of 6');
  await page.locator('.mat-mdc-paginator-page-size-select').click();
  await page.getByRole('option', {name: '5', exact: true}).click();
}

const sortBy = (page: Page, header: string) => page.locator(`th.mat-sort-header:has-text("${header}")`).click();

test('pages five at a time, by name, each owner once', async ({page}) => {
  await searchTheGridOwnersFiveAPage(page);

  await expectBothPages(page, ['a', 'b', 'c', 'c', 'd', 'e'].map(name));
});

test('sorts by city, then by name within a city, both ways', async ({page}) => {
  await searchTheGridOwnersFiveAPage(page);

  await sortBy(page, 'City');
  await expectBothPages(page, ['b', 'e', 'd', 'c', 'c', 'a'].map(name));

  await sortBy(page, 'City');
  await expectBothPages(page, ['a', 'c', 'c', 'd', 'b', 'e'].map(name));
});

test('only Name and City can be sorted', async ({page}) => {
  await searchTheGridOwnersFiveAPage(page);

  await expect(page.locator('th.mat-sort-header')).toHaveText(['Name', 'City']);
});

test('the address bar keeps the view: a refresh, a shared link and Back show the same page',
  async ({page, browser}) => {
  await searchTheGridOwnersFiveAPage(page);
  await sortBy(page, 'City');
  await sortBy(page, 'City');
  await page.locator('.mat-mdc-paginator-navigation-next').click();
  await expect(rangeLabel(page)).toHaveText('6 – 6 of 6');
  const sameView = async (p: Page) => {
    await expect(rangeLabel(p)).toHaveText('6 – 6 of 6');
    await expect.poll(() => namesOnThePage(p)).toEqual([name('e')]);
    await expect(p.locator('#lastName')).toHaveValue(PREFIX);
  };

  expect(new URL(page.url()).search).toBe(`?lastName=${PREFIX}&sort=city,desc&page=2&size=5`);

  await page.reload();
  await sameView(page);

  const someoneElse = await browser.newPage();
  await someoneElse.goto(page.url());
  await sameView(someoneElse);
  await someoneElse.close();

  await cells(page).first().locator('a').click();
  await page.locator('h2:has-text("Owner Information")').waitFor();
  await page.goBack();
  await sameView(page);
});
