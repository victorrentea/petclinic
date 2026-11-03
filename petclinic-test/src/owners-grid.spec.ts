import {test, expect} from './support/trace-fixture';
import axios from 'axios';

// The Owners grid pages and sorts on the server, and keeps where it is in the URL:
// change the page size, sort by City twice, go to page 2, reload (still there), open an
// owner and press Back (still there). The Default dataset has more owners than one page.
test.use({dbFixture: 'default'});

const API = process.env.API_BASE_URL || 'http://localhost:8080/api';

async function namesOnServer(query: string): Promise<string[]> {
  const {data} = await axios.get(`${API}/owners?${query}`, {timeout: 10_000});
  return data.content.map((o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`);
}

test('pages, sorts and remembers where it was', async ({page}) => {
  const rows = page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await rows.allTextContents()).map((t) => t.trim());

  await page.goto('/owners');
  await expect(rows).toHaveCount(10);

  await page.locator('mat-paginator mat-select').click();
  await page.getByRole('option', {name: '5', exact: true}).click();
  await expect(rows).toHaveCount(5);
  await expect(page).toHaveURL(/size=5/);

  await page.locator('th.mat-sort-header', {hasText: 'City'}).click();
  await page.locator('th.mat-sort-header', {hasText: 'City'}).click();
  await expect(page).toHaveURL(/sort=city(,|%2C)desc/);

  await page.getByRole('button', {name: 'Next page'}).click();
  await expect(page).toHaveURL(/page=1/);
  const secondPage = await namesOnServer('page=1&size=5&sort=city,desc');
  await expect.poll(listed).toEqual(secondPage);

  await page.reload();
  await expect(page).toHaveURL(/page=1/);
  await expect.poll(listed).toEqual(secondPage);

  const url = page.url();
  await rows.first().locator('a').click();
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await page.goBack();
  await expect(page).toHaveURL(url);
  await expect.poll(listed).toEqual(secondPage);
});
