import { test, expect } from '@playwright/test';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_PAGE_SIZE = 10;
const LARGE_PAGE_SIZE = 20;
const MULTI_PAGE_QUERY = 'o';

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
    // Capture screenshot after each test
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('shows the first owner page on initial load', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    const expectedPage = await apiClient.fetchOwnerPage();
    await ownersPage.open();
    await ownersPage.waitForOwnersCount(expectedPage.content.length);
    const actualFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFullNames).toEqual(ApiClient.getFullNames(expectedPage.content));
    expect(await ownersPage.getRowsPerPageValue()).toBe(`${DEFAULT_PAGE_SIZE}`);
    expect(await ownersPage.getPaginationLabels()).toEqual(['1', '2']);
  });

  test('supports numbered pagination for filtered results', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.search(MULTI_PAGE_QUERY);
    await page.waitForURL(url => {
      const searchParams = new URL(url).searchParams;
      return searchParams.get('query') === MULTI_PAGE_QUERY
        && searchParams.get('page') === '0'
        && searchParams.get('size') === `${DEFAULT_PAGE_SIZE}`
        && searchParams.get('sort') === 'name,asc';
    });

    const expectedSecondPage = await apiClient.fetchOwnerPage({
      query: MULTI_PAGE_QUERY,
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      sort: 'name,asc'
    });

    await ownersPage.clickPage(2);
    await page.waitForURL(url => {
      const searchParams = new URL(url).searchParams;
      return searchParams.get('query') === MULTI_PAGE_QUERY
        && searchParams.get('page') === '1';
    });
    await ownersPage.waitForOwnersCount(expectedSecondPage.content.length);

    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.getFullNames(expectedSecondPage.content));
    expect(await ownersPage.getPaginationLabels()).toEqual(['1', '2']);
  });

  test('supports rows per page selection and city sorting', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.changeRowsPerPage(LARGE_PAGE_SIZE);
    await page.waitForURL(url => {
      const searchParams = new URL(url).searchParams;
      return searchParams.get('page') === '0'
        && searchParams.get('size') === `${LARGE_PAGE_SIZE}`
        && searchParams.get('sort') === 'name,asc';
    });

    await ownersPage.toggleSort('City');
    await page.waitForURL(url => new URL(url).searchParams.get('sort') === 'city,asc');

    const expectedPage = await apiClient.fetchOwnerPage({
      size: LARGE_PAGE_SIZE,
      sort: 'city,asc'
    });

    await ownersPage.waitForOwnersCount(expectedPage.content.length);

    expect(await ownersPage.getRowsPerPageValue()).toBe(`${LARGE_PAGE_SIZE}`);
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.getFullNames(expectedPage.content));
  });

  test('restores URL-driven search, page, size, and sort state after refresh', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    const expectedPage = await apiClient.fetchOwnerPage({
      query: MULTI_PAGE_QUERY,
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      sort: 'city,desc'
    });

    await ownersPage.open('query=o&page=1&size=10&sort=city,desc');
    await ownersPage.waitForOwnersCount(expectedPage.content.length);

    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.getFullNames(expectedPage.content));
    expect(await ownersPage.getRowsPerPageValue()).toBe(`${DEFAULT_PAGE_SIZE}`);
    expect(new URL(page.url()).search).toContain('query=o');
    expect(new URL(page.url()).search).toContain('page=1');
    expect(new URL(page.url()).search).toContain('size=10');
    expect(decodeURIComponent(new URL(page.url()).search)).toContain('sort=city,desc');

    await page.reload();
    await ownersPage.waitForOwnersCount(expectedPage.content.length);

    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.getFullNames(expectedPage.content));
  });
});
