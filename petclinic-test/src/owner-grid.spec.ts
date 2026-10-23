import {test, expect, Page} from './support/trace-fixture';
import axios from 'axios';

// The Owners grid pages and sorts on the server (issue #25): every step below must show
// exactly the rows the API returns for the same query, and keep that query in the URL.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

type OwnerQuery = {page: number; size: number; sort: 'name' | 'city'; dir: 'asc' | 'desc'};

async function namesFromApi(query: OwnerQuery): Promise<string[]> {
  const {data} = await axios.get(`${API_BASE}/owners`, {params: query, timeout: 10_000});
  return data.content.map((o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`);
}

async function expectGridToShow(page: Page, query: OwnerQuery): Promise<void> {
  const expected = await namesFromApi(query);
  const cells = page.locator('#ownersTable td.ownerFullName');
  await expect.poll(async () => (await cells.allTextContents()).map((t) => t.trim()), {timeout: 10_000})
    .toEqual(expected);
}

/** The grid shows the server's answer to `query`, and the URL holds `query` so refresh/Back keep it. */
async function expectGridAndUrlToShow(page: Page, query: OwnerQuery): Promise<void> {
  await expectGridToShow(page, query);
  await expect(page).toHaveURL(
    new RegExp(`page=${query.page}&size=${query.size}&sort=${query.sort}&dir=${query.dir}`));
}

test.use({dbFixture: 'default'});

test('sorts by city, pages, and changes page size, all answered by the server', async ({page}) => {
  await page.goto('/owners');
  await expect(page.locator('#ownersTable td.ownerFullName').first()).toBeVisible();

  const cityHeader = page.locator('#ownersTable th.mat-column-city');
  await cityHeader.click();
  await cityHeader.click();
  await expectGridAndUrlToShow(page, {page: 0, size: 10, sort: 'city', dir: 'desc'});

  await page.getByRole('button', {name: 'Next page'}).click();
  await expectGridAndUrlToShow(page, {page: 1, size: 10, sort: 'city', dir: 'desc'});

  await page.locator('#ownersTable mat-select').click();
  await page.getByRole('option', {name: '5', exact: true}).click();
  await expectGridAndUrlToShow(page, {page: 0, size: 5, sort: 'city', dir: 'desc'});
  await expect(page.locator('#ownersTable .mat-mdc-paginator-range-label'))
    .toHaveText(/^\s*Page 1 – 1\.\.5 of \d+\s*$/);

  await page.reload();
  await expectGridAndUrlToShow(page, {page: 0, size: 5, sort: 'city', dir: 'desc'});
});

test('Telephone, Address and Pets headers do not sort', async ({page}) => {
  await page.goto('/owners');
  await expect(page.locator('#ownersTable td.ownerFullName').first()).toBeVisible();
  const sortOfEachOwnersRequest: (string | null)[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/api/owners')) sortOfEachOwnersRequest.push(url.searchParams.get('sort'));
  });

  for (const column of ['address', 'telephone', 'pets']) {
    await page.locator(`#ownersTable th.mat-column-${column}`).click();
  }
  // Waiting for "nothing happened" needs an end: a City click is sent after any request the clicks
  // above would have sent, so once its answer is in, every one of theirs would have been recorded too.
  const cityAnswer = page.waitForResponse((response) => response.url().includes('sort=city'));
  await page.locator('#ownersTable th.mat-column-city').click();
  await cityAnswer;

  expect(sortOfEachOwnersRequest).toEqual(['city']);
});
