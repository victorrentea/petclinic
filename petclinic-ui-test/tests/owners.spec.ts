import { test, expect } from '@playwright/test';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Owners Page', () => {
  let apiClient: ApiClient;
  let screenshotDir: string;

  test.beforeAll(() => {
    apiClient = new ApiClient();
    screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('shows the first page of owners sorted by name (last-name-first)', async ({ page }) => {
    const apiPage = await apiClient.fetchOwnerPage({ page: 0, size: 10, sort: 'name,asc' });
    const expected = ApiClient.getFullNamesLastFirst(apiPage.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(expected);
    expect(expected.length).toBeLessThanOrEqual(10);
  });

  test('paginates to the next page and updates the range label', async ({ page }) => {
    const firstPage = await apiClient.fetchOwnerPage({ page: 0, size: 10, sort: 'name,asc' });
    test.skip(firstPage.totalElements <= 10, 'needs more than one page of owners');
    const secondPage = await apiClient.fetchOwnerPage({ page: 1, size: 10, sort: 'name,asc' });
    const expected = ApiClient.getFullNamesLastFirst(secondPage.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.clickNext();

    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(expected);

    const end = 10 + secondPage.content.length;
    expect(await ownersPage.getRangeLabel()).toBe(`Showing 11–${end} of ${firstPage.totalElements}`);
  });

  test('sorts by Name descending when the header is clicked', async ({ page }) => {
    const descPage = await apiClient.fetchOwnerPage({ page: 0, size: 10, sort: 'name,desc' });
    const expected = ApiClient.getFullNamesLastFirst(descPage.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.clickSortByName(); // default is name asc -> toggles to desc

    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(expected);
  });

  test('changes the page size to 20', async ({ page }) => {
    const apiPage = await apiClient.fetchOwnerPage({ page: 0, size: 20, sort: 'name,asc' });
    test.skip(apiPage.totalElements <= 10, 'needs more than 10 owners to observe a larger page');
    const expectedCount = Math.min(20, apiPage.totalElements);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.selectPageSize(20);

    await expect.poll(async () => (await ownersPage.getOwnerFullNames()).length).toBe(expectedCount);
  });

  test('restores page/size/sort from a deep link', async ({ page }) => {
    const apiPage = await apiClient.fetchOwnerPage({ page: 1, size: 5, sort: 'city,desc' });
    test.skip(apiPage.content.length === 0, 'needs data on the second page');
    const expected = ApiClient.getFullNamesLastFirst(apiPage.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.goToUrl('page=1&size=5&sort=city,desc');

    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(expected);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    const allOwners = await apiClient.fetchOwners();
    const prefix = ApiClient.choosePrefixFrom(allOwners);
    const expectedFiltered = await apiClient.fetchOwnersByPrefix(prefix);
    const expected = ApiClient.getFullNamesLastFirst(expectedFiltered);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.searchByLastNamePrefix(prefix);

    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  test('shows "No owners found" and hides the paginator for no matches', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.searchByLastNamePrefix('Zzqzxqzzz');

    await expect(ownersPage.noOwnersFound).toBeVisible();
    await expect(ownersPage.paginator).toHaveCount(0);
  });
});
