import axios from 'axios';
import {test, expect, Page} from './support/trace-fixture';

// The owners grid as a user walks it: a shared link, then sort, size and filter, into an owner
// and back. What it pins is that the applied state lives in the URL — so Back, Forward and a
// refresh restore it — and that the filter searches the whole register, not the page on screen.

test.use({dbFixture: 'default'});

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

async function ownersApi(params: Record<string, string | number>) {
  const {data} = await axios.get(`${API_BASE}/owners`, {params, timeout: 10_000});
  return data;
}

const rows = (page: Page) => page.locator('#ownersTable td.ownerFullName');
const range = (page: Page) => page.locator('#owners-range');

test('a shared link, sort, size and filter all survive Back and refresh', async ({page}) => {
  const {totalElements: everyone, totalPages} = await ownersApi({size: 5});
  const defaultFirstPage = (await ownersApi({})).content.map((o: any) => o.lastName);
  // last in the default order: certainly not on the first page of ten
  const lateOwner = (await ownersApi({page: totalPages - 1, size: 5})).content.at(-1);
  expect(defaultFirstPage).not.toContain(lateOwner.lastName);

  // 1. a deep link opens exactly that state
  await page.goto('/owners?page=1&size=5&sort=city,desc');
  await expect(rows(page)).toHaveCount(5);
  await expect(range(page)).toHaveText(`6-10 of ${everyone}`);
  await expect(page.locator('#sort-city').locator('..')).toHaveAttribute('aria-sort', 'descending');

  // 2. sorting by another column starts it ascending and goes back to the first page
  await page.locator('#sort-lastName').click();
  await expect(page).toHaveURL(/page=0&size=5&sort=lastName,asc/);
  await expect(range(page)).toHaveText(`1-5 of ${everyone}`);

  // 3. a bigger page
  await page.locator('app-combo select').selectOption({label: '20'});
  await expect(page).toHaveURL(/size=20/);
  await expect(rows(page)).toHaveCount(20);

  // 4. a filter finds an owner who is not on the default first page
  await page.fill('#lastName', lateOwner.lastName.slice(0, 4));
  await page.locator('#search-owner-form button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`lastName=${encodeURIComponent(lateOwner.lastName.slice(0, 4))}`));
  const lateOwnerLink = page.locator('td.ownerFullName a', {hasText: `${lateOwner.lastName}, ${lateOwner.firstName}`});
  await expect(lateOwnerLink).toBeVisible();
  const filteredUrl = page.url();

  // 5. into the owner, and Back to the very same list
  await lateOwnerLink.click();
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(lateOwnerLink).toBeVisible();
  await expect(page.locator('#lastName')).toHaveValue(lateOwner.lastName.slice(0, 4));

  // 6. and a refresh restores it too
  await page.reload();
  await expect(page).toHaveURL(filteredUrl);
  await expect(lateOwnerLink).toBeVisible();
  await expect(page.locator('#sort-lastName').locator('..')).toHaveAttribute('aria-sort', 'ascending');
});
