import { test, expect } from './support/trace-fixture';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient, DEFAULT_PAGE_SIZE, DEFAULT_SORT } from './support/api-client';
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
    // Capture screenshot after each test
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('shows only the first server page of owners on initial load', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // The grid renders exactly the page the server returns — never the whole table.
    const firstPage = await apiClient.fetchOwnerPage({ page: 0, size: DEFAULT_PAGE_SIZE, sort: DEFAULT_SORT });
    const expectedFullNames = ApiClient.getFullNames(firstPage.content);

    await ownersPage.open();
    await ownersPage.waitForOwnersCount(expectedFullNames.length);

    const actualFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFullNames).toEqual(expectedFullNames);
    expect(actualFullNames.length).toBeLessThanOrEqual(DEFAULT_PAGE_SIZE);
    // The seed data must actually span more than one page, or this test proves nothing.
    expect(firstPage.totalElements).toBeGreaterThan(DEFAULT_PAGE_SIZE);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    // Walk every page to pick a prefix that really exists in the data.
    const allOwners = await apiClient.fetchAllOwners();
    const prefix = ApiClient.choosePrefixFrom(allOwners);

    // The filtered grid is paged too: compare against the filtered *first page*.
    const filteredFirstPage = await apiClient.fetchOwnerPage({
      lastName: prefix,
      page: 0,
      size: DEFAULT_PAGE_SIZE,
      sort: DEFAULT_SORT,
    });
    const expectedFilteredFullNames = ApiClient.getFullNames(filteredFirstPage.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await ownersPage.searchByLastNamePrefix(prefix);
    await ownersPage.waitForOwnersCount(expectedFilteredFullNames.length);

    const actualFilteredFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFilteredFullNames.length).toBeGreaterThan(0);

    // Every rendered row matches the prefix — the Name cell reads "Last, First".
    for (const fullName of actualFilteredFullNames) {
      const lastName = ApiClient.extractLastName(fullName);
      expect(lastName.toLowerCase()).toMatch(new RegExp(`^${prefix.toLowerCase()}`));
    }

    expect(ApiClient.sorted(actualFilteredFullNames)).toEqual(
      ApiClient.sorted(expectedFilteredFullNames)
    );
  });
});
